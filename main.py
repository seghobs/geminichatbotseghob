import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
import os
from PIL import Image
import base64
import mimetypes
from io import BytesIO

app = Flask(__name__, static_url_path='/static', static_folder='static')

# Gemini API anahtarınızı yapılandırın
API_KEY = "YOUR_API_KEY"  # API anahtarınızı buraya girin
genai.configure(api_key=API_KEY)

# Yüklenen resimlerin kaydedileceği klasör
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Gemini modeli için varsayılan ayarlar ve güvenlik ayarları
generation_config = {
    "temperature": 0.9,
    "top_k": 32,
    "top_p": 1,
    "max_output_tokens": 4096,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Modeli başlat
model = genai.GenerativeModel(
    model_name="gemini-exp-1206",  # gemini-exp-1206 yerine gemini-pro-vision kullanıyoruz
    generation_config=generation_config,
    safety_settings=safety_settings
)

# Sohbet geçmişini tutacak liste
chat_history = []

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return render_template("index.html", chat_history=chat_history)

@app.route("/chat", methods=["POST"])
def chat():
    global chat_history
    if request.is_json:
        data = request.get_json()
        user_input = data.get("prompt")

        # Resim ve metin ayrımı
        image_part = None
        text_part = ""
        for part in user_input:
            if isinstance(part, dict) and part.get("mime_type"):
                image_part = part
            else:
                text_part += str(part)

        try:
            if image_part:
                # Base64 verisinden resmi BytesIO ile oluştur
                image = Image.open(BytesIO(base64.b64decode(image_part["data"])))

                # Modeli çağırırken Image nesnesini kullan
                response = model.generate_content([text_part, image]) # image_part yerine image kullanın
            else:
                response = model.generate_content(text_part)

            bot_response = response.text

            # Resim varsa base64 verisini sakla
            if image_part:
              chat_history.append({"type": "user", "message": [{"mime_type": image_part["mime_type"], "data": image_part["data"]}, text_part]})
            else:
              chat_history.append({"type": "user", "message": [text_part]})
            chat_history.append({"type": "bot", "message": bot_response})
            return jsonify({"response": bot_response})

        except Exception as e:
            print(f"Hata: {e}")
            error_message = f"Üzgünüm, bir hata oluştu: {e}"
            chat_history.append({"type": "bot", "message": error_message})
            return jsonify({"response": error_message})

    else:
        user_input = request.form["message"]
        file = request.files.get('image')

        if file and allowed_file(file.filename):
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            image = Image.open(filepath)

            try:
                response = model.generate_content([user_input, image])
                bot_response = response.text
                # Resmi tekrar base64'e çevirip saklayalım.
                with open(filepath, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                mime_type = mimetypes.guess_type(filepath)[0]

                chat_history.append({"type": "user", "message": [{"mime_type": mime_type, "data": encoded_string}, user_input]})
                chat_history.append({"type": "bot", "message": bot_response})
                return jsonify({"response": bot_response})

            except Exception as e:
                print(f"Hata: {e}")
                error_message = f"Üzgünüm, bir hata oluştu: {e}"
                chat_history.append({"type": "bot", "message": error_message})
                return jsonify({"response": error_message})
        else:
            try:
                response = model.generate_content(user_input)
                bot_response = response.text
                chat_history.append({"type": "user", "message": [user_input]})
                chat_history.append({"type": "bot", "message": bot_response})
                return jsonify({"response": bot_response})

            except Exception as e:
                print(f"Hata: {e}")
                error_message = f"Üzgünüm, bir hata oluştu: {e}"
                chat_history.append({"type": "bot", "message": error_message})
                return jsonify({"response": error_message})

@app.route("/clear", methods=["POST"])
def clear_chat():
    global chat_history
    chat_history = []
    return jsonify({"status": "success"})

if __name__ == "__main__":
    app.run(debug=True)
