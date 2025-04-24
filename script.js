const webhookUrl = "https://adform.app.n8n.cloud/webhook-test/voice-trigger";
let isListening = true;
let recognition;
let lastTranscript = ""; // Menyimpan transcript terakhir untuk mencegah duplikasi

// Initialize speech recognition
function initRecognition() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    document.getElementById('status').textContent = 'Speech recognition not supported in this browser';
    document.getElementById('status').className = 'status error';
    document.getElementById('toggleButton').disabled = true;
    return null;
  }

  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'id-ID';
  recognition.interimResults = false; // Mengubah ke false untuk hanya mendapatkan hasil final
  recognition.maxAlternatives = 1;
  recognition.continuous = true;

  // Handle results - perbaikan utama di sini
  recognition.onresult = function (event) {
    // Cek semua hasil dari speech recognition event
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        const voiceText = event.results[i][0].transcript;
        
        // Hanya proses jika berbeda dari transcript terakhir
        if (voiceText !== lastTranscript) {
          lastTranscript = voiceText;
          processVoiceInput(voiceText);
        }
      }
    }
  };

  // Fungsi untuk memproses input suara
  function processVoiceInput(voiceText) {
    const resultElement = document.getElementById('result');
    const historyElement = document.getElementById('history');
    const statusElement = document.getElementById('status');
    
    resultElement.textContent = voiceText;

    // Add user message to chat history
    const timestamp = new Date().toLocaleTimeString();
    const userMessage = document.createElement('div');
    userMessage.classList.add('chat-message', 'user-message');
    userMessage.innerHTML = `<strong>${timestamp} (You):</strong> "${voiceText}"`;
    historyElement.appendChild(userMessage);

    // Scroll chat to bottom
    historyElement.scrollTop = historyElement.scrollHeight;

    // Send to webhook
    statusElement.textContent = 'Sending to Shene...';

    // Kode yang diubah: mengirim data ke webhook dan menangani respons asli dari n8n
    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ chatInput: voiceText })
    })
    .then(async (response) => {
      if (response.ok) {
        statusElement.textContent = 'Sent to Shene! Waiting for response...';
        statusElement.className = 'status success';
        
        // Mengambil dan menggunakan data respons asli dari n8n
        const data = await response.json();
        const replyText = data.reply;
        
        // Menangani respons AI dengan teks asli
        handleAIResponse({ text: replyText });
        
        // Membacakan respons menggunakan text-to-speech
        speechSynthesis.speak(new SpeechSynthesisUtterance(replyText));
      } else {
        statusElement.textContent = 'Error sending to Shene. Continuing to listen...';
        statusElement.className = 'status error';
      }
    })
    .catch(error => {
      statusElement.textContent = 'Network error: ' + error.message + '. Continuing to listen...';
      statusElement.className = 'status error';
    });
  }

  // Fungsi untuk menangani respons AI
  function handleAIResponse(aiResponse) {
      const historyElement = document.getElementById('history');
      const statusElement = document.getElementById('status');

      // Add AI message to chat history
      const timestamp = new Date().toLocaleTimeString();
      const aiMessage = document.createElement('div');
      aiMessage.classList.add('chat-message', 'ai-message');
      aiMessage.innerHTML = `<strong>${timestamp} (AI):</strong> "${aiResponse.text}"`;
      historyElement.appendChild(aiMessage);

      // Scroll chat to bottom
      historyElement.scrollTop = historyElement.scrollHeight;

      statusElement.textContent = 'Listening...';
      statusElement.className = 'status';
  }

  // Handle errors dengan perbaikan
  recognition.onerror = function(event) {
    if (event.error === 'no-speech') {
      // Hanya update status, jangan restart
      document.getElementById('status').textContent = 'No speech detected. Still listening...';
      return;
    } else if (event.error === 'not-allowed') {
      document.getElementById('status').textContent = 'Microphone access denied. Please allow microphone access and reload the page.';
      document.getElementById('status').className = 'status error';
      isListening = false; // Stop attempts if permission denied
      document.getElementById('toggleButton').textContent = 'Start Listening';
      document.getElementById('result').className = '';
      return;
    }

    document.getElementById('status').textContent = 'Error: ' + event.error + '. Restarting...';
    document.getElementById('status').className = 'status error';

    // Tunggu sebelum mencoba lagi
    setTimeout(() => {
      if (isListening) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
        setTimeout(startListening, 500);
      }
    }, 1000);
  };

  // Ketika recognition berakhir, restart jika masih dalam mode listening
  recognition.onend = function() {
    if (isListening) {
      try {
        // Tunggu sebentar sebelum memulai ulang untuk mencegah siklus cepat
        setTimeout(startListening, 300);
      } catch (e) {
        console.error("Error restarting recognition:", e);
      }
    }
  };

  return recognition;
}

// Start listening dengan perbaikan
function startListening() {
  if (!recognition) {
    recognition = initRecognition();
    if (!recognition) return;
  }

  try {
    recognition.start();
    document.getElementById('result').className = 'recording';
    document.getElementById('status').textContent = 'Continuously listening...';
    document.getElementById('status').className = 'status';
  } catch (error) {
    console.error("Error starting recognition:", error);
    // Jika sudah berjalan, coba stop dulu
    try {
      recognition.stop();
    } catch (e) {
      // Ignore errors when stopping
    }
    
    // Buat ulang instance dan coba lagi
    recognition = null;
    setTimeout(() => {
      recognition = initRecognition();
      if (isListening && recognition) {
        recognition.start();
      }
    }, 500);
  }
}

// Toggle listening on/off
document.getElementById('toggleButton').addEventListener('click', function() {
  if (isListening) {
    // Stop listening
    isListening = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    this.textContent = 'Start Listening';
    document.getElementById('result').className = '';
    document.getElementById('status').textContent = 'Listening paused';
  } else {
    // Start listening
    isListening = true;
    this.textContent = 'Stop Listening';
    startListening();
  }
});

// Fungsi untuk meminta akses mikrofon (karena nampaknya tidak ada di kode asli)
function requestMicrophoneAccess() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      // Akses berhasil
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      // Setup canvas and frequency graph if needed
      setupFrequencyGraph(analyser);
    })
    .catch(err => {
      console.error('Error accessing microphone:', err);
      document.getElementById('status').textContent = 'Microphone access denied. Please allow microphone access and reload the page.';
      document.getElementById('status').className = 'status error';
    });
}

// Fungsi untuk setup frequency graph
function setupFrequencyGraph(analyser) {
  const canvas = document.getElementById('frequency-graph');
  if (!canvas) return;
  
  const canvasCtx = canvas.getContext('2d');
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function drawFrequencyGraph() {
    requestAnimationFrame(drawFrequencyGraph);

    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const averageAmplitude = sum / bufferLength;

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for(let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];

      // Scale bar height based on average amplitude
      const scaleFactor = (averageAmplitude / 128); // Normalize to 0-1 range
      const scaledBarHeight = barHeight * (1 + scaleFactor); // Add scaling

      canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
      canvasCtx.fillRect(x, canvas.height - scaledBarHeight/2, barWidth, scaledBarHeight/2);

      x += barWidth + 1;
    }
  }

  drawFrequencyGraph();
}

// Start when page loads
window.onload = function() {
  requestMicrophoneAccess();
  startListening();
};
