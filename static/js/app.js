const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message");
const imageInput = document.getElementById("image");
const chatbox = document.getElementById("chatbox");
const clearChatButton = document.getElementById("clear-chat");
const themeToggle = document.getElementById('theme-toggle');


// Sayfa yüklendiğinde temayı kontrol et ve ayarla
document.addEventListener('DOMContentLoaded', () => {
    setThemeOnLoad();
});

// Local Storage'dan temayı al ve ayarla
function setThemeOnLoad() {
    if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        themeToggleLightIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        themeToggleDarkIcon.classList.remove('hidden');
    }
}

// Dark/Light mod ikonlarını göster/gizle
var themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
var themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

// Tema değiştirme butonuna tıklama olayı
themeToggle.addEventListener('click', () => {
    themeToggleDarkIcon.classList.toggle('hidden');
    themeToggleLightIcon.classList.toggle('hidden');

    if (localStorage.getItem('color-theme')) {
        if (localStorage.getItem('color-theme') === 'light') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        }
    } else {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        }
    }
});

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = messageInput.value;
    const image = imageInput.files[0];
    messageInput.value = "";
    imageInput.value = "";

    const formData = new FormData();
    formData.append("message", message);
    if (image) {
        formData.append("image", image);
    }

    await sendMessage(formData, message, image); // sendMessage fonksiyonunu async olarak çağırıyoruz
});

async function sendMessage(formData, message, image) {
    // Kullanıcı mesajını ve resmi sohbet kutusuna ekleyin
    addMessageToChatbox("user", message, image);

    // Yazıyor göstergesini ekleyin
    const typingElement = createTypingIndicator();
    chatbox.appendChild(typingElement);
    chatbox.scrollTop = chatbox.scrollHeight;

    // Prompt'u oluşturun
    let prompt = [];
    if (image) {
        // Resmi base64 formatına dönüştürün
        const base64Image = await toBase64(image); // await kullanarak base64 dönüşümünün tamamlanmasını bekliyoruz
        prompt.push({
            "mime_type": image.type,
            "data": base64Image
        });
        prompt.push(message);
    } else {
        prompt.push(message);
    }

    // İsteği JSON formatında gönderin
    const response = await fetch("/chat", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt }), // Sadece prompt'u gönderin
    });
    const data = await response.json();

    // Yazıyor göstergesini kaldırın
    chatbox.removeChild(typingElement);

    // Bot mesajını sohbet kutusuna ekleyin
    addMessageToChatbox("bot", data.response);
}

// Resmi base64 formatına dönüştürmek için yardımcı fonksiyon
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

clearChatButton.addEventListener("click", async () => {
    const response = await fetch("/clear", {
        method: "POST",
    });
    const data = await response.json();
    if (data.status === "success") {
        chatbox.innerHTML = '';
        chatHistory = [];
    }
});

function addMessageToChatbox(type, message, image = null) {
    const messageContainer = document.createElement("div");
    messageContainer.classList.add("message-container", type);

    if (type === "user") {
        const messageContent = `
            <div class="message-content">
                <div class="message-user">
                    ${image ? `<img src="${URL.createObjectURL(image)}" class="mt-2 max-h-64 rounded">` : ''}
                    ${message}
                </div>
            </div>
            <div class="avatar avatar-user">S</div>
        `;
        messageContainer.innerHTML = messageContent;
    } else {
        const messageContent = `
            <div class="avatar avatar-bot">
                <img class="h-10 w-10 rounded-full" src="{{ url_for('static', filename='images/gemini-profile.png') }}" alt="Gemini Logo">
            </div>
            <div class="message-content">
                <div class="message-bot">${message}</div>
            </div>
        `;
        messageContainer.innerHTML = messageContent;
    }

    chatbox.appendChild(messageContainer);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function createTypingIndicator() {
    const typingElement = document.createElement("div");
    typingElement.classList.add("flex", "items-start", "mb-4");
    typingElement.innerHTML = `
        <div class="flex-shrink-0">
            <img class="h-10 w-10 rounded-full" src="{{ url_for('static', filename='images/gemini-profile.png') }}" alt="Gemini Logo">
        </div>
        <div class="ml-3">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-300">Gemini</p>
            <div class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl p-3 mt-1 max-w-lg shadow-md typing">
            </div>
        </div>
    `;
    return typingElement;
}