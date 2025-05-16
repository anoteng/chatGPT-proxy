from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
import openai
import sqlite3
import os
from uuid import uuid4

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get("FLASK_SECRET_KEY", str(uuid4()))  # For session management
openai.api_key = os.environ.get("OPENAI_API_KEY")

DB_PATH = "chat.db"

# Ensure database and table exist
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER,
                role TEXT,
                content TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        username = request.form.get("username")
        if not username:
            return render_template("login.html", error="Username is required")

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if row:
                user_id = row[0]
            else:
                cursor = conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
                user_id = cursor.lastrowid

        session["user_id"] = user_id
        session["username"] = username
        return redirect(url_for("chat"))

    if "user_id" in session:
        return redirect(url_for("chat"))
    return render_template("login.html")

@app.route("/chat")
def chat():
    if "user_id" not in session:
        return redirect(url_for("index"))
    user_id = session["user_id"]
    with sqlite3.connect(DB_PATH) as conn:
        threads = conn.execute("SELECT id, title FROM threads WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    return render_template("chat.html", username=session["username"], threads=threads)

@app.route("/new_thread", methods=["POST"])
def new_thread():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    title = request.json.get("title", "Untitled thread")
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("INSERT INTO threads (user_id, title) VALUES (?, ?)", (session["user_id"], title))
        thread_id = cursor.lastrowid
    return jsonify({"thread_id": thread_id, "title": title})

@app.route("/chat/<int:thread_id>", methods=["POST"])
def post_message(thread_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    message = request.json.get("message")
    if not message:
        return jsonify({"error": "No message provided."}), 400

    with sqlite3.connect(DB_PATH) as conn:
        # Validate thread ownership
        row = conn.execute("SELECT id FROM threads WHERE id = ? AND user_id = ?", (thread_id, session["user_id"])).fetchone()
        if not row:
            return jsonify({"error": "Thread not found."}), 404

        # Store user message
        conn.execute("INSERT INTO messages (thread_id, role, content) VALUES (?, ?, ?)", (thread_id, "user", message))
        cursor = conn.execute("SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id ASC", (thread_id,))
        messages = [{"role": role, "content": content} for role, content in cursor.fetchall()]

    try:
        client = openai.OpenAI()
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=messages
        )
        reply = response.choices[0].message.content

        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT INTO messages (thread_id, role, content) VALUES (?, ?, ?)", (thread_id, "assistant", reply))

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5005, debug=True)

