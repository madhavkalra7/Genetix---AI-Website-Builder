"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'bn' | 'tr' | 'pl' | 'nl' | 'sv' | 'vi' | 'th' | 'id';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

// English as base
const enTranslations = {
  // Navbar
  'nav.promptGenerator': 'Prompt Generator',
  'nav.signUp': 'Sign Up',
  'nav.signIn': 'Sign In',
  
  // Home Hero
  'home.title': 'Build With Genetix',
  'home.subtitle': 'Your imagination. AI execution. 🚀',
  'home.browseTemplates': '✨ Browse Templates',
  'home.welcome': 'WELCOME',
  'home.selectedTemplate': 'Selected Template',
  'home.clear': 'Clear',
  'home.selectTech': '🔧 Select Technology Stack',
  'home.placeholder': '🌑 e.g. Build a crypto dashboard with real-time updates',
  'home.launch': 'Launch 🚀',
  'home.needHelp': 'Need help crafting this? Get a concise, better prompt.',
  'home.enhancePrompt': 'Enhance this prompt',
  
  // Tech Stack
  'tech.react': 'React + Next.js',
  'tech.reactDesc': 'Modern web apps with React and Next.js',
  'tech.html': 'HTML + CSS + JavaScript',
  'tech.htmlDesc': 'Vanilla web development',
  'tech.vue': 'Vue.js + Nuxt',
  'tech.vueDesc': 'Vue-based web applications',
  'tech.angular': 'Angular',
  'tech.angularDesc': 'Enterprise web applications',
  'tech.svelte': 'Svelte + SvelteKit',
  'tech.svelteDesc': 'Fast and lightweight apps',
  
  // Templates Page
  'templates.title': 'Website Templates',
  'templates.subtitle': 'Choose a template to start building',
  'templates.backHome': 'Back to Home',
  'templates.clickPreview': '👁️ Click to Preview',
  'templates.useTemplate': 'Use Template',
  'templates.preview': '👁️ Preview',
  'templates.selectLanguage': 'SELECT LANGUAGE',
  'templates.all': 'All',
  'templates.business': 'Business',
  'templates.portfolio': 'Portfolio',
  'templates.restaurant': 'Restaurant',
  'templates.ecommerce': 'E-Commerce',
  'templates.blog': 'Blog',
  'templates.gaming': 'Gaming',
  
  // Projects
  'projects.title': "{name}'s Genetix",
  'projects.noProjects': 'No projects found',
  'projects.loading': 'Loading projects...',
  
  // Prompts
  'prompt.landing': 'Create a landing page',
  'prompt.dashboard': 'Build Admin Dashboard',
  'prompt.kanban': 'Create Kanban Board',
  'prompt.ecommerce': 'Build E-commerce Site',
  'prompt.netflix': 'Create netflix clone',
  'prompt.portfolio': 'Build Portfolio Website',
  'prompt.tictactoe': 'Create tic tac toe game',
  'prompt.rockpaper': 'Build rock paper scissor game',
};

const translations: Record<LanguageCode, Record<string, string>> = {
  en: enTranslations,
  es: {
    // Navbar
    'nav.promptGenerator': 'Generador de Indicaciones',
    'nav.signUp': 'Registrarse',
    'nav.signIn': 'Iniciar Sesión',
    
    // Home Hero
    'home.title': 'Construye con Genetix',
    'home.subtitle': 'Tu imaginación. Ejecución de IA. 🚀',
    'home.browseTemplates': '✨ Explorar Plantillas',
    'home.welcome': 'BIENVENIDO',
    'home.selectedTemplate': 'Plantilla Seleccionada',
    'home.clear': 'Limpiar',
    'home.selectTech': '🔧 Seleccionar Pila Tecnológica',
    'home.placeholder': '🌑 ej. Construir un panel de criptomonedas con actualizaciones en tiempo real',
    'home.launch': 'Lanzar 🚀',
    'home.needHelp': '¿Necesitas ayuda para crear esto? Obtén una indicación mejor y más concisa.',
    'home.enhancePrompt': 'Mejorar esta indicación',
    
    // Tech Stack
    'tech.react': 'React + Next.js',
    'tech.reactDesc': 'Aplicaciones web modernas con React y Next.js',
    'tech.html': 'HTML + CSS + JavaScript',
    'tech.htmlDesc': 'Desarrollo web vanilla',
    'tech.vue': 'Vue.js + Nuxt',
    'tech.vueDesc': 'Aplicaciones web basadas en Vue',
    'tech.angular': 'Angular',
    'tech.angularDesc': 'Aplicaciones web empresariales',
    'tech.svelte': 'Svelte + SvelteKit',
    'tech.svelteDesc': 'Aplicaciones rápidas y ligeras',
    
    // Templates Page
    'templates.title': 'Plantillas de Sitios Web',
    'templates.subtitle': 'Elige una plantilla para comenzar a construir',
    'templates.backHome': 'Volver al Inicio',
    'templates.clickPreview': '👁️ Haz clic para Vista Previa',
    'templates.useTemplate': 'Usar Plantilla',
    'templates.preview': '👁️ Vista Previa',
    'templates.selectLanguage': 'SELECCIONAR IDIOMA',
    'templates.all': 'Todos',
    'templates.business': 'Negocios',
    'templates.portfolio': 'Portafolio',
    'templates.restaurant': 'Restaurante',
    'templates.ecommerce': 'Comercio Electrónico',
    'templates.blog': 'Blog',
    'templates.gaming': 'Juegos',
    
    // Projects
    'projects.title': "Genetix de {name}",
    'projects.noProjects': 'No se encontraron proyectos',
    'projects.loading': 'Cargando proyectos...',
    
    // Prompts
    'prompt.landing': 'Crear una página de inicio',
    'prompt.dashboard': 'Construir panel de administración',
    'prompt.kanban': 'Crear tablero Kanban',
    'prompt.ecommerce': 'Construir sitio de comercio electrónico',
    'prompt.netflix': 'Crear clon de Netflix',
    'prompt.portfolio': 'Construir sitio web de portafolio',
    'prompt.tictactoe': 'Crear juego de tres en raya',
    'prompt.rockpaper': 'Construir juego de piedra papel tijera',
  },
  hi: {
    // Navbar
    'nav.promptGenerator': 'प्रॉम्प्ट जेनरेटर',
    'nav.signUp': 'साइन अप करें',
    'nav.signIn': 'साइन इन करें',
    
    // Home Hero
    'home.title': 'Genetix के साथ बनाएं',
    'home.subtitle': 'आपकी कल्पना। AI निष्पादन। 🚀',
    'home.browseTemplates': '✨ टेम्पलेट्स ब्राउज़ करें',
    'home.welcome': 'स्वागत है',
    'home.selectedTemplate': 'चयनित टेम्पलेट',
    'home.clear': 'साफ़ करें',
    'home.selectTech': '🔧 टेक्नोलॉजी स्टैक चुनें',
    'home.placeholder': '🌑 जैसे। रियल-टाइम अपडेट के साथ क्रिप्टो डैशबोर्ड बनाएं',
    'home.launch': 'लॉन्च करें 🚀',
    'home.needHelp': 'इसे बनाने में मदद चाहिए? बेहतर प्रॉम्प्ट प्राप्त करें।',
    'home.enhancePrompt': 'इस प्रॉम्प्ट को बेहतर बनाएं',
    
    // Tech Stack
    'tech.react': 'React + Next.js',
    'tech.reactDesc': 'React और Next.js के साथ आधुनिक वेब ऐप्स',
    'tech.html': 'HTML + CSS + JavaScript',
    'tech.htmlDesc': 'वैनिला वेब डेवलपमेंट',
    'tech.vue': 'Vue.js + Nuxt',
    'tech.vueDesc': 'Vue-आधारित वेब एप्लिकेशन',
    'tech.angular': 'Angular',
    'tech.angularDesc': 'एंटरप्राइज वेब एप्लिकेशन',
    'tech.svelte': 'Svelte + SvelteKit',
    'tech.svelteDesc': 'तेज़ और हल्के ऐप्स',
    
    // Templates Page
    'templates.title': 'वेबसाइट टेम्पलेट्स',
    'templates.subtitle': 'बनाना शुरू करने के लिए एक टेम्पलेट चुनें',
    'templates.backHome': 'होम पर वापस जाएं',
    'templates.clickPreview': '👁️ प्रीव्यू के लिए क्लिक करें',
    'templates.useTemplate': 'टेम्पलेट उपयोग करें',
    'templates.preview': '👁️ प्रीव्यू',
    'templates.selectLanguage': 'भाषा चुनें',
    'templates.all': 'सभी',
    'templates.business': 'व्यवसाय',
    'templates.portfolio': 'पोर्टफोलियो',
    'templates.restaurant': 'रेस्तरां',
    'templates.ecommerce': 'ई-कॉमर्स',
    'templates.blog': 'ब्लॉग',
    'templates.gaming': 'गेमिंग',
    
    // Projects
    'projects.title': "{name} का Genetix",
    'projects.noProjects': 'कोई प्रोजेक्ट नहीं मिला',
    'projects.loading': 'प्रोजेक्ट्स लोड हो रहे हैं...',
    
    // Prompts
    'prompt.landing': 'लैंडिंग पेज बनाएं',
    'prompt.dashboard': 'एडमिन डैशबोर्ड बनाएं',
    'prompt.kanban': 'कानबन बोर्ड बनाएं',
    'prompt.ecommerce': 'ई-कॉमर्स साइट बनाएं',
    'prompt.netflix': 'नेटफ्लिक्स क्लोन बनाएं',
    'prompt.portfolio': 'पोर्टफोलियो वेबसाइट बनाएं',
    'prompt.tictactoe': 'टिक टैक टो गेम बनाएं',
    'prompt.rockpaper': 'रॉक पेपर सिजर गेम बनाएं',
  },
  // Other languages with base translations from English
  fr: { ...enTranslations, 'home.title': 'Construire avec Genetix', 'home.subtitle': 'Votre imagination. Exécution IA. 🚀' },
  de: { ...enTranslations, 'home.title': 'Mit Genetix erstellen', 'home.subtitle': 'Ihre Fantasie. KI-Ausführung. 🚀' },
  it: { ...enTranslations, 'home.title': 'Costruisci con Genetix', 'home.subtitle': 'La tua immaginazione. Esecuzione AI. 🚀' },
  pt: { ...enTranslations, 'home.title': 'Construir com Genetix', 'home.subtitle': 'Sua imaginação. Execução de IA. 🚀' },
  ru: { ...enTranslations, 'home.title': 'Создавайте с Genetix', 'home.subtitle': 'Ваше воображение. Исполнение ИИ. 🚀' },
  zh: { ...enTranslations, 'home.title': '使用 Genetix 构建', 'home.subtitle': '你的想象力。AI 执行。🚀' },
  ja: { ...enTranslations, 'home.title': 'Genetix で構築', 'home.subtitle': 'あなたの想像力。AI実行。🚀' },
  ko: { ...enTranslations, 'home.title': 'Genetix로 구축', 'home.subtitle': '당신의 상상력. AI 실행. 🚀' },
  ar: { ...enTranslations, 'home.title': 'بناء مع Genetix', 'home.subtitle': 'خيالك. تنفيذ الذكاء الاصطناعي. 🚀' },
  bn: { ...enTranslations, 'home.title': 'Genetix এর সাথে তৈরি করুন', 'home.subtitle': 'আপনার কল্পনা। AI নির্বাহ। 🚀' },
  tr: { ...enTranslations, 'home.title': 'Genetix ile Oluştur', 'home.subtitle': 'Hayal gücünüz. AI yürütme. 🚀' },
  pl: { ...enTranslations, 'home.title': 'Buduj z Genetix', 'home.subtitle': 'Twoja wyobraźnia. Wykonanie AI. 🚀' },
  nl: { ...enTranslations, 'home.title': 'Bouwen met Genetix', 'home.subtitle': 'Jouw verbeelding. AI-uitvoering. 🚀' },
  sv: { ...enTranslations, 'home.title': 'Bygg med Genetix', 'home.subtitle': 'Din fantasi. AI-körning. 🚀' },
  vi: { ...enTranslations, 'home.title': 'Xây dựng với Genetix', 'home.subtitle': 'Trí tưởng tượng của bạn. Thực thi AI. 🚀' },
  th: { ...enTranslations, 'home.title': 'สร้างด้วย Genetix', 'home.subtitle': 'จินตนาการของคุณ การดำเนินการ AI 🚀' },
  id: { ...enTranslations, 'home.title': 'Bangun dengan Genetix', 'home.subtitle': 'Imajinasi Anda. Eksekusi AI. 🚀' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    const saved = localStorage.getItem('preferred-language') as LanguageCode;
    if (saved && translations[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
