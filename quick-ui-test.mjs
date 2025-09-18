#!/usr/bin/env node

/**
 * БЫСТРОЕ ТЕСТИРОВАНИЕ UI ФУНКЦИЙ CYPHR MESSENGER
 * Проверка работы реальных компонентов через DOM API
 */

import puppeteer from 'puppeteer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('🚀 БЫСТРОЕ ТЕСТИРОВАНИЕ UI ФУНКЦИЙ CYPHR MESSENGER');
console.log('=' .repeat(60));

let browser;
let page;

async function setupBrowser() {
  console.log('🌐 Запуск браузера для UI тестирования...');
  
  try {
    browser = await puppeteer.launch({
      headless: false, // Показывать браузер для визуального контроля
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--allow-running-insecure-content',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });
    
    page = await browser.newPage();
    
    // Настройка разрешений для камеры и микрофона
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:5173', [
      'camera',
      'microphone',
      'notifications'
    ]);
    
    await page.setViewport({ width: 1280, height: 720 });
    console.log('✅ Браузер настроен для тестирования');
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка настройки браузера:', error.message);
    return false;
  }
}

async function testMainApplication() {
  console.log('\n📱 ТЕСТ 1: ГЛАВНОЕ ПРИЛОЖЕНИЕ');
  
  try {
    console.log('🔄 Загрузка http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Ждем загрузки React приложения
    await page.waitForSelector('body', { timeout: 5000 });
    
    // Проверяем заголовок страницы
    const title = await page.title();
    console.log('📄 Заголовок страницы:', title);
    
    // Проверяем наличие ключевых элементов
    const cyphrElements = await page.evaluate(() => {
      const elements = {
        hasLogo: !!document.querySelector('[class*="logo"], [class*="Cyphr"]'),
        hasButtons: document.querySelectorAll('button').length > 0,
        hasInputs: document.querySelectorAll('input').length > 0,
        bodyClasses: document.body.className,
        cyphrText: document.body.textContent.includes('Cyphr'),
        reactRoot: !!document.querySelector('#root, [data-reactroot]')
      };
      
      return elements;
    });
    
    console.log('🔍 Элементы UI:');
    console.log('   • Логотип:', cyphrElements.hasLogo ? '✅ Найден' : '❌ Не найден');
    console.log('   • Кнопки:', cyphrElements.hasButtons ? '✅ Найдены' : '❌ Не найдены');
    console.log('   • Поля ввода:', cyphrElements.hasInputs ? '✅ Найдены' : '❌ Не найдены');
    console.log('   • React root:', cyphrElements.reactRoot ? '✅ Активен' : '❌ Отсутствует');
    console.log('   • Cyphr упоминания:', cyphrElements.cyphrText ? '✅ Присутствуют' : '❌ Отсутствуют');
    
    // Попробуем найти элементы регистрации
    const registrationElements = await page.evaluate(() => {
      const phoneInputs = document.querySelectorAll('input[type="tel"], input[placeholder*="phone"], input[placeholder*="номер"]');
      const otpInputs = document.querySelectorAll('input[placeholder*="code"], input[placeholder*="код"], [class*="otp"]');
      const submitButtons = document.querySelectorAll('button[type="submit"], button:contains("Войти"), button:contains("Отправить")');
      
      return {
        phoneInputs: phoneInputs.length,
        otpInputs: otpInputs.length,
        submitButtons: submitButtons.length,
        currentUrl: window.location.href
      };
    });
    
    console.log('📱 Элементы регистрации:');
    console.log('   • Поля телефона:', registrationElements.phoneInputs);
    console.log('   • Поля OTP:', registrationElements.otpInputs);
    console.log('   • Кнопки отправки:', registrationElements.submitButtons);
    console.log('   • Текущий URL:', registrationElements.currentUrl);
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка тестирования главного приложения:', error.message);
    return false;
  }
}

async function testInteractiveTestPage() {
  console.log('\n🧪 ТЕСТ 2: ИНТЕРАКТИВНАЯ ТЕСТОВАЯ СТРАНИЦА');
  
  try {
    console.log('🔄 Загрузка test-real-ui-functions.html...');
    await page.goto('http://localhost:5173/test-real-ui-functions.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Проверяем заголовок
    const title = await page.title();
    console.log('📄 Заголовок:', title);
    
    // Проверяем наличие тестовых секций
    const testSections = await page.evaluate(() => {
      const sections = document.querySelectorAll('.test-section');
      const testNames = Array.from(sections).map(section => {
        const heading = section.querySelector('h3');
        return heading ? heading.textContent : 'Без названия';
      });
      
      return {
        count: sections.length,
        names: testNames,
        hasButtons: document.querySelectorAll('button').length > 0,
        hasChatInterface: !!document.getElementById('test-chat'),
        hasVideoElements: !!document.querySelector('video'),
        hasFileDropZone: !!document.getElementById('file-drop-zone')
      };
    });
    
    console.log('🧪 Тестовые секции:', testSections.count);
    testSections.names.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });
    
    console.log('🔍 Интерактивные элементы:');
    console.log('   • Кнопки:', testSections.hasButtons ? '✅ Найдены' : '❌ Отсутствуют');
    console.log('   • Чат интерфейс:', testSections.hasChatInterface ? '✅ Есть' : '❌ Нет');
    console.log('   • Видео элементы:', testSections.hasVideoElements ? '✅ Есть' : '❌ Нет');
    console.log('   • Зона загрузки файлов:', testSections.hasFileDropZone ? '✅ Есть' : '❌ Нет');
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка тестирования интерактивной страницы:', error.message);
    return false;
  }
}

async function testMessagingFunction() {
  console.log('\n💬 ТЕСТ 3: ФУНКЦИЯ СООБЩЕНИЙ');
  
  try {
    // Проверяем чат интерфейс
    const chatExists = await page.$('#test-chat');
    if (!chatExists) {
      console.log('⚠️ Чат интерфейс не найден, переходим к альтернативному тесту');
      return false;
    }
    
    console.log('📝 Тестирование отправки сообщения...');
    
    // Вводим тестовое сообщение
    await page.type('#message-input', 'Тестовое E2E зашифрованное сообщение 🔐');
    await page.waitForTimeout(500);
    
    // Нажимаем кнопку отправки
    await page.click('button[onclick="sendTestMessage()"]');
    await page.waitForTimeout(1000);
    
    // Проверяем, появилось ли сообщение
    const messagesCount = await page.evaluate(() => {
      const messages = document.querySelectorAll('.message');
      return messages.length;
    });
    
    console.log('📨 Отправленных сообщений:', messagesCount);
    
    if (messagesCount > 0) {
      console.log('✅ Функция отправки сообщений работает');
      
      // Ждем возможного ответа
      await page.waitForTimeout(2000);
      
      const finalMessageCount = await page.evaluate(() => {
        const messages = document.querySelectorAll('.message');
        return messages.length;
      });
      
      if (finalMessageCount > messagesCount) {
        console.log('✅ Получение ответных сообщений работает');
      }
      
      return true;
    } else {
      console.log('❌ Сообщения не отправляются');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования сообщений:', error.message);
    return false;
  }
}

async function testMediaPermissions() {
  console.log('\n🎥 ТЕСТ 4: РАЗРЕШЕНИЯ КАМЕРЫ И МИКРОФОНА');
  
  try {
    // Проверяем доступность Media API
    const mediaSupport = await page.evaluate(async () => {
      try {
        const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        
        if (!hasGetUserMedia) {
          return { supported: false, error: 'getUserMedia не поддерживается' };
        }
        
        // Попробуем получить доступ к микрофону
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach(track => track.stop());
          
          // Попробуем получить доступ к камере
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoStream.getTracks().forEach(track => track.stop());
            
            return { 
              supported: true, 
              audio: true, 
              video: true,
              error: null
            };
          } catch (videoError) {
            return { 
              supported: true, 
              audio: true, 
              video: false,
              error: 'Камера недоступна: ' + videoError.message
            };
          }
        } catch (audioError) {
          return { 
            supported: true, 
            audio: false, 
            video: false,
            error: 'Микрофон недоступен: ' + audioError.message
          };
        }
      } catch (error) {
        return { supported: false, error: error.message };
      }
    });
    
    console.log('🔍 Поддержка Media API:', mediaSupport.supported ? '✅ Да' : '❌ Нет');
    
    if (mediaSupport.supported) {
      console.log('🎤 Доступ к микрофону:', mediaSupport.audio ? '✅ Есть' : '❌ Нет');
      console.log('📹 Доступ к камере:', mediaSupport.video ? '✅ Есть' : '❌ Нет');
      
      if (mediaSupport.error) {
        console.log('⚠️ Примечание:', mediaSupport.error);
      }
      
      return mediaSupport.audio && mediaSupport.video;
    } else {
      console.log('❌ Ошибка:', mediaSupport.error);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования медиа разрешений:', error.message);
    return false;
  }
}

async function testWebRTCSupport() {
  console.log('\n🌐 ТЕСТ 5: ПОДДЕРЖКА WEBRTC');
  
  try {
    const webrtcSupport = await page.evaluate(() => {
      const support = {
        RTCPeerConnection: !!window.RTCPeerConnection,
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        RTCDataChannel: !!window.RTCDataChannel,
        webkitRTCPeerConnection: !!window.webkitRTCPeerConnection,
        mozRTCPeerConnection: !!window.mozRTCPeerConnection
      };
      
      // Попробуем создать RTCPeerConnection
      try {
        const pc = new RTCPeerConnection();
        support.canCreatePeerConnection = true;
        pc.close();
      } catch (error) {
        support.canCreatePeerConnection = false;
        support.peerConnectionError = error.message;
      }
      
      return support;
    });
    
    console.log('🔍 WebRTC компоненты:');
    console.log('   • RTCPeerConnection:', webrtcSupport.RTCPeerConnection ? '✅ Есть' : '❌ Нет');
    console.log('   • getUserMedia:', webrtcSupport.getUserMedia ? '✅ Есть' : '❌ Нет');
    console.log('   • RTCDataChannel:', webrtcSupport.RTCDataChannel ? '✅ Есть' : '❌ Нет');
    console.log('   • Создание соединения:', webrtcSupport.canCreatePeerConnection ? '✅ Работает' : '❌ Ошибка');
    
    if (webrtcSupport.peerConnectionError) {
      console.log('⚠️ Ошибка PeerConnection:', webrtcSupport.peerConnectionError);
    }
    
    const isFullySupported = webrtcSupport.RTCPeerConnection && 
                           webrtcSupport.getUserMedia && 
                           webrtcSupport.canCreatePeerConnection;
    
    console.log('🏁 WebRTC полностью поддерживается:', isFullySupported ? '✅ Да' : '❌ Нет');
    
    return isFullySupported;
    
  } catch (error) {
    console.error('❌ Ошибка тестирования WebRTC:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Очистка ресурсов...');
  
  if (browser) {
    await browser.close();
    console.log('✅ Браузер закрыт');
  }
}

// Главная функция
async function runUITests() {
  console.log('⏰ Время начала:', new Date().toLocaleString());
  const startTime = Date.now();
  
  const results = {
    setup: false,
    mainApp: false,
    testPage: false,
    messaging: false,
    mediaPermissions: false,
    webrtcSupport: false
  };
  
  try {
    // Настройка браузера
    results.setup = await setupBrowser();
    if (!results.setup) {
      throw new Error('Не удалось настроить браузер');
    }
    
    // Тестирование главного приложения
    results.mainApp = await testMainApplication();
    
    // Тестирование интерактивной страницы
    results.testPage = await testInteractiveTestPage();
    
    // Тестирование функции сообщений
    results.messaging = await testMessagingFunction();
    
    // Тестирование медиа разрешений
    results.mediaPermissions = await testMediaPermissions();
    
    // Тестирование WebRTC
    results.webrtcSupport = await testWebRTCSupport();
    
  } catch (error) {
    console.error('💥 Критическая ошибка тестирования:', error.message);
  } finally {
    await cleanup();
  }
  
  // Подведение итогов
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 РЕЗУЛЬТАТЫ UI ТЕСТИРОВАНИЯ');
  console.log('='.repeat(60));
  
  const testNames = {
    setup: '🌐 Настройка браузера',
    mainApp: '📱 Главное приложение',
    testPage: '🧪 Тестовая страница',
    messaging: '💬 Функция сообщений',
    mediaPermissions: '🎥 Медиа разрешения',
    webrtcSupport: '🌐 WebRTC поддержка'
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
  console.log(`⏱️ Время выполнения: ${duration} секунд`);
  
  if (passed === total) {
    console.log('\n🎉 ВСЕ UI ТЕСТЫ ПРОЙДЕНЫ!');
  } else if (passed >= Math.ceil(total * 0.75)) {
    console.log('\n✅ БОЛЬШИНСТВО ТЕСТОВ ПРОЙДЕНО');
  } else {
    console.log('\n⚠️ ТРЕБУЮТСЯ ИСПРАВЛЕНИЯ');
  }
  
  console.log('⏰ Время завершения:', new Date().toLocaleString());
  console.log('='.repeat(60));
  
  return passed === total;
}

// Запускаем если файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  runUITests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Фатальная ошибка:', error);
    process.exit(1);
  });
}

export { runUITests };