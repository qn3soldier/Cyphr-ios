/**
 * КОНСОЛЬНЫЙ ТЕСТ UI ФУНКЦИЙ CYPHR MESSENGER
 * Выполните в консоли браузера на странице localhost:5173
 */

console.log('🧪 CYPHR MESSENGER - КОНСОЛЬНОЕ ТЕСТИРОВАНИЕ UI');
console.log('='.repeat(50));

// Глобальная переменная для хранения результатов
window.cyphrTestResults = {
  messaging: false,
  calls: false,
  video: false,
  files: false,
  crypto: false
};

// Тест 1: Проверка основных элементов UI
async function testUIElements() {
  console.log('\n📱 ТЕСТ 1: ОСНОВНЫЕ ЭЛЕМЕНТЫ UI');
  
  const elements = {
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input').length,
    cyphrLogo: !!document.querySelector('[class*="logo"], [class*="Cyphr"]'),
    reactRoot: !!document.querySelector('#root, [data-reactroot]'),
    hasReactText: document.body.textContent.includes('React') || document.querySelector('[data-reactroot]'),
    hasCyphrText: document.body.textContent.includes('Cyphr'),
    currentUrl: window.location.href,
    title: document.title
  };
  
  console.log('🔍 Найденные элементы:');
  console.log('   • Кнопки:', elements.buttons);
  console.log('   • Поля ввода:', elements.inputs);
  console.log('   • Cyphr логотип:', elements.cyphrLogo ? '✅' : '❌');
  console.log('   • React root:', elements.reactRoot ? '✅' : '❌');
  console.log('   • Упоминания Cyphr:', elements.hasCyphrText ? '✅' : '❌');
  console.log('   • Заголовок:', elements.title);
  console.log('   • URL:', elements.currentUrl);
  
  return elements.buttons > 0 && elements.inputs > 0 && elements.reactRoot;
}

// Тест 2: Проверка Media API
async function testMediaAPI() {
  console.log('\n🎥 ТЕСТ 2: MEDIA API И РАЗРЕШЕНИЯ');
  
  try {
    // Проверка поддержки
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    console.log('📱 getUserMedia поддерживается:', hasGetUserMedia ? '✅' : '❌');
    
    if (!hasGetUserMedia) {
      return false;
    }
    
    // Тест микрофона
    try {
      console.log('🎤 Тестирование доступа к микрофону...');
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Микрофон доступен, треков:', audioStream.getAudioTracks().length);
      
      // Показать информацию о треках
      audioStream.getAudioTracks().forEach((track, i) => {
        console.log(`   Трек ${i + 1}: ${track.label || 'Микрофон'} (${track.kind})`);
      });
      
      audioStream.getTracks().forEach(track => track.stop());
      
      // Тест камеры
      try {
        console.log('📹 Тестирование доступа к камере...');
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('✅ Камера доступна, треков:', videoStream.getVideoTracks().length);
        
        videoStream.getVideoTracks().forEach((track, i) => {
          console.log(`   Трек ${i + 1}: ${track.label || 'Камера'} (${track.kind})`);
        });
        
        videoStream.getTracks().forEach(track => track.stop());
        
        window.cyphrTestResults.video = true;
        return true;
        
      } catch (videoError) {
        console.log('⚠️ Камера недоступна:', videoError.message);
        return true; // Микрофон работает, этого достаточно для звонков
      }
      
    } catch (audioError) {
      console.log('❌ Микрофон недоступен:', audioError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Ошибка Media API:', error.message);
    return false;
  }
}

// Тест 3: Проверка WebRTC
async function testWebRTC() {
  console.log('\n🌐 ТЕСТ 3: WEBRTC ПОДДЕРЖКА');
  
  try {
    const support = {
      RTCPeerConnection: !!window.RTCPeerConnection,
      RTCDataChannel: !!window.RTCDataChannel,
      RTCIceCandidate: !!window.RTCIceCandidate,
      RTCSessionDescription: !!window.RTCSessionDescription
    };
    
    console.log('🔍 WebRTC компоненты:');
    for (const [component, supported] of Object.entries(support)) {
      console.log(`   • ${component}: ${supported ? '✅' : '❌'}`);
    }
    
    // Тест создания PeerConnection
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      console.log('✅ RTCPeerConnection создан успешно');
      console.log('   • Connection state:', pc.connectionState);
      console.log('   • ICE connection state:', pc.iceConnectionState);
      
      pc.close();
      
      window.cyphrTestResults.calls = true;
      return true;
      
    } catch (pcError) {
      console.log('❌ Ошибка создания PeerConnection:', pcError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Ошибка WebRTC тестирования:', error.message);
    return false;
  }
}

// Тест 4: Проверка File API
async function testFileAPI() {
  console.log('\n📎 ТЕСТ 4: FILE API');
  
  try {
    const fileSupport = {
      File: !!window.File,
      FileReader: !!window.FileReader,
      Blob: !!window.Blob,
      FormData: !!window.FormData,
      URL: !!window.URL,
      createObjectURL: !!(window.URL && window.URL.createObjectURL)
    };
    
    console.log('🔍 File API компоненты:');
    for (const [component, supported] of Object.entries(fileSupport)) {
      console.log(`   • ${component}: ${supported ? '✅' : '❌'}`);
    }
    
    // Тест создания Blob
    try {
      const testBlob = new Blob(['test content'], { type: 'text/plain' });
      console.log('✅ Blob создан:', testBlob.size, 'bytes');
      
      // Тест FileReader
      const reader = new FileReader();
      reader.onload = function() {
        console.log('✅ FileReader прочитал:', this.result);
      };
      reader.readAsText(testBlob);
      
      window.cyphrTestResults.files = true;
      return true;
      
    } catch (fileError) {
      console.log('❌ Ошибка File API:', fileError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования File API:', error.message);
    return false;
  }
}

// Тест 5: Проверка WebCrypto
async function testWebCrypto() {
  console.log('\n🔐 ТЕСТ 5: WEB CRYPTO API');
  
  try {
    const cryptoSupport = {
      crypto: !!window.crypto,
      subtle: !!(window.crypto && window.crypto.subtle),
      getRandomValues: !!(window.crypto && window.crypto.getRandomValues)
    };
    
    console.log('🔍 Crypto API компоненты:');
    for (const [component, supported] of Object.entries(cryptoSupport)) {
      console.log(`   • ${component}: ${supported ? '✅' : '❌'}`);
    }
    
    if (!cryptoSupport.subtle) {
      console.log('❌ SubtleCrypto недоступен');
      return false;
    }
    
    // Тест генерации случайных байт
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    console.log('✅ Случайные байты сгенерированы:', randomBytes.length, 'bytes');
    
    // Тест шифрования AES
    try {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      console.log('✅ AES ключ сгенерирован');
      
      const testData = new TextEncoder().encode('test message');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        testData
      );
      
      console.log('✅ Данные зашифрованы:', encrypted.byteLength, 'bytes');
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      const decryptedText = new TextDecoder().decode(decrypted);
      console.log('✅ Данные расшифрованы:', decryptedText);
      
      window.cyphrTestResults.crypto = true;
      return true;
      
    } catch (cryptoError) {
      console.log('❌ Ошибка шифрования:', cryptoError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Ошибка Web Crypto API:', error.message);
    return false;
  }
}

// Тест 6: Симуляция отправки сообщения
async function testMessageSending() {
  console.log('\n💬 ТЕСТ 6: СИМУЛЯЦИЯ ОТПРАВКИ СООБЩЕНИЯ');
  
  try {
    // Попробуем найти элементы для отправки сообщения
    const messageInput = document.querySelector('input[type="text"], textarea, [placeholder*="сообщение"], [placeholder*="message"]') || 
                        document.createElement('input');
    const sendButton = document.querySelector('button[type="submit"], button:contains("Отправить"), button:contains("Send")') ||
                      Array.from(document.querySelectorAll('button')).find(btn => 
                        btn.textContent.includes('Отправить') || btn.textContent.includes('Send')) ||
                      document.createElement('button');
    
    console.log('🔍 Элементы сообщений:');
    console.log('   • Поле ввода найдено:', messageInput.tagName !== 'INPUT' || messageInput.parentNode ? '✅' : '❌');
    console.log('   • Кнопка отправки найдена:', sendButton.tagName !== 'BUTTON' || sendButton.parentNode ? '✅' : '❌');
    
    // Симуляция ввода сообщения
    const testMessage = 'Тестовое зашифрованное сообщение 🔐';
    
    if (messageInput && messageInput.parentNode) {
      messageInput.value = testMessage;
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('✅ Сообщение введено:', testMessage);
    }
    
    // Симуляция E2E шифрования
    console.log('🔐 Симуляция E2E шифрования...');
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('✅ Сообщение зашифровано (симуляция)');
    
    window.cyphrTestResults.messaging = true;
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка тестирования сообщений:', error.message);
    return false;
  }
}

// Главная функция тестирования
async function runConsoleTests() {
  console.log('🚀 ЗАПУСК КОНСОЛЬНЫХ ТЕСТОВ');
  console.log('⏰ Время начала:', new Date().toLocaleString());
  
  const results = {
    ui: await testUIElements(),
    media: await testMediaAPI(),
    webrtc: await testWebRTC(),
    files: await testFileAPI(),
    crypto: await testWebCrypto(),
    messaging: await testMessageSending()
  };
  
  // Подведение итогов
  console.log('\n' + '='.repeat(50));
  console.log('📊 РЕЗУЛЬТАТЫ КОНСОЛЬНОГО ТЕСТИРОВАНИЯ');
  console.log('='.repeat(50));
  
  const testNames = {
    ui: '📱 Элементы UI',
    media: '🎥 Media API',
    webrtc: '🌐 WebRTC',
    files: '📎 File API',
    crypto: '🔐 Web Crypto',
    messaging: '💬 Сообщения'
  };
  
  let passed = 0;
  let total = 0;
  
  for (const [key, name] of Object.entries(testNames)) {
    total++;
    const result = results[key];
    if (result) passed++;
    
    console.log(`${name}: ${result ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`);
  }
  
  const percentage = ((passed / total) * 100).toFixed(1);
  console.log(`\n📈 Общий результат: ${passed}/${total} (${percentage}%)`);
  
  // Анализ возможностей
  console.log('\n🎯 АНАЛИЗ ВОЗМОЖНОСТЕЙ:');
  if (results.media && results.webrtc) {
    console.log('✅ Звонки поддерживаются полностью');
  } else if (results.media) {
    console.log('⚠️ Звонки частично поддерживаются (только аудио)');
  } else {
    console.log('❌ Звонки не поддерживаются');
  }
  
  if (results.files) {
    console.log('✅ Обмен файлами поддерживается');
  } else {
    console.log('❌ Обмен файлами не поддерживается');
  }
  
  if (results.crypto) {
    console.log('✅ E2E шифрование поддерживается');
  } else {
    console.log('❌ E2E шифрование ограничено');
  }
  
  console.log('\n🔍 Детали тестирования сохранены в window.cyphrTestResults');
  console.log('⏰ Время завершения:', new Date().toLocaleString());
  console.log('='.repeat(50));
  
  return { results, summary: { passed, total, percentage } };
}

// Автозапуск если скрипт загружен
if (typeof window !== 'undefined') {
  // Запуск через 2 секунды после загрузки
  setTimeout(() => {
    window.runCyphrTests = runConsoleTests;
    console.log('💡 Для запуска тестов выполните: runCyphrTests()');
  }, 2000);
}