from flask import Flask, request, jsonify, render_template, send_from_directory
import openai
import sqlite3
import os

app = Flask(__name__, static_folder='static')
openai.api_key = os.environ.get("OPENAI_API_KEY")

DB_PATH = "chat.db"

# Ensure database and table exist
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                role TEXT,
                content TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

@app.route("/")
def index():
    user = request.args.get("user", "default")
    return render_template("index.html", user=user)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user = data.get("user", "default")
    message = data.get("message")

    if not message:
        return jsonify({"error": "No message provided."}), 400

    # Lagre brukerens melding
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO messages (user, role, content) VALUES (?, ?, ?)", (user, "user", message))

        # Hent siste 20 meldinger for bruker
        cursor = conn.execute(
            "SELECT role, content FROM messages WHERE user = ? ORDER BY id DESC LIMIT 20", (user,))
        rows = cursor.fetchall()[::-1]  # Reverse to get chronological order

    messages = [{"role": role, "content": content} for role, content in rows]

    try:
        client = openai.OpenAI()
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=messages
        )
        reply = response.choices[0].message.content

        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT INTO messages (user, role, content) VALUES (?, ?, ?)", (user, "assistant", reply))

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5005, debug=True)
