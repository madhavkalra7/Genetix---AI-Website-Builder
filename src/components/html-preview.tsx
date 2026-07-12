"use client";

import { useEffect, useRef, useState } from "react";

interface HTMLPreviewProps {
  files: { [path: string]: string };
  className?: string;
}

export function HTMLPreview({ files, className }: HTMLPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState<string>('index.html');

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    
    // Function to load a specific HTML page
    const loadPage = (pageName: string) => {
      const cleanPageName = pageName.replace(/^\/?(home\/user\/)?/, '');
      
      let htmlContent = files[cleanPageName] || 
                        files[`/home/user/${cleanPageName}`] || 
                        files[`/${cleanPageName}`] ||
                        files['index.html'] ||
                        files['/home/user/index.html'] ||
                        files['/index.html'];
      
      if (!htmlContent) return;

      // Get all CSS files
      const cssFiles = Object.keys(files).filter(filename => 
        filename.endsWith('.css') && files[filename]
      );

      // Get all JS files
      const jsFiles = Object.keys(files).filter(filename => 
        filename.endsWith('.js') && files[filename]
      );

      // Get all image files
      const imageFiles = Object.keys(files).filter(filename => 
        /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(filename) && files[filename]
      );

      // Replace ALL image references with base64 data URLs
      imageFiles.forEach(imageFile => {
        const imageContent = files[imageFile];
        if (imageContent && imageContent.startsWith('data:')) {
          const baseName = imageFile.split('/').pop() || imageFile;
          
          // Create multiple regex patterns to catch all variations using the base name and absolute path
          const patterns = [
            new RegExp(`(src=["'])${baseName}(["'])`, 'gi'),           // src="image-1.jpg"
            new RegExp(`(src=["'])\\.\\/${baseName}(["'])`, 'gi'),      // src="./image-1.jpg"
            new RegExp(`(src=["'])\\/+${baseName}(["'])`, 'gi'),        // src="/image-1.jpg"
            new RegExp(`(src=["'])\\s*${baseName}(["'])`, 'gi'),       // src=" image-1.jpg"
            new RegExp(`(src=["'])${imageFile}(["'])`, 'gi'),          // src="/home/user/image-1.jpg"
          ];
          
          patterns.forEach(pattern => {
            htmlContent = htmlContent.replace(pattern, `$1${imageContent}$2`);
          });
          
          console.log(`✅ Replaced ${imageFile} (base: ${baseName}) with base64 data URL`);
        }
      });

      // Inject CSS inline
      cssFiles.forEach(cssFile => {
        const cssContent = files[cssFile];
        if (cssContent) {
          const cssInjection = `<style>\n/* ${cssFile} */\n${cssContent}\n</style>`;
          
          if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', `${cssInjection}\n</head>`);
          } else if (htmlContent.includes('<head>')) {
            htmlContent = htmlContent.replace('<head>', `<head>\n${cssInjection}`);
          }
        }
      });

      // Inject JS inline
      jsFiles.forEach(jsFile => {
        const jsContent = files[jsFile];
        if (jsContent) {
          const jsInjection = `<script>\n/* ${jsFile} */\n${jsContent}\n</script>`;
          
          if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', `${jsInjection}\n</body>`);
          } else {
            htmlContent += jsInjection;
          }
        }
      });

      // Inject navigation interceptor script
      const navigationScript = `
        <script>
          (function() {
            // Intercept all link clicks
            document.addEventListener('click', function(e) {
              const target = e.target.closest('a');
              if (target && target.href) {
                const url = new URL(target.href, window.location.href);
                const filename = url.pathname.split('/').pop();
                
                // Check if it's an HTML file
                if (filename && filename.endsWith('.html')) {
                  e.preventDefault();
                  
                  // Send message to parent to load the new page
                  window.parent.postMessage({
                    type: 'navigate',
                    page: filename
                  }, '*');
                }
              }
            }, true);
          })();
        </script>
      `;

      // Style to hide browser scrollbars and enforce mobile-first layout bounds
      const hideScrollbarStyle = `
        <style>
          /* Hide scrollbar for Chrome, Safari and Opera */
          *::-webkit-scrollbar {
            display: none !important;
          }
          html::-webkit-scrollbar, body::-webkit-scrollbar {
            display: none !important;
          }
          /* Hide scrollbar for IE, Edge and Firefox */
          html, body {
            -ms-overflow-style: none !important;  /* IE and Edge */
            scrollbar-width: none !important;  /* Firefox */
            overflow-x: hidden !important;
            overflow-y: auto !important;
            max-width: 100vw;
            box-sizing: border-box;
          }
        </style>
      `;

      htmlContent = htmlContent.replace('</head>', `${navigationScript}\n${hideScrollbarStyle}\n</head>`);

      // Write to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Dynamic style injection to guarantee scrollbar hiding regardless of HTML structure
        try {
          const styleEl = iframeDoc.createElement('style');
          styleEl.textContent = `
            *::-webkit-scrollbar {
              display: none !important;
            }
            html::-webkit-scrollbar, body::-webkit-scrollbar {
              display: none !important;
            }
            html, body {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
              overflow-x: hidden !important;
              overflow-y: auto !important;
              max-width: 100vw !important;
              box-sizing: border-box !important;
            }
          `;
          const target = iframeDoc.head || iframeDoc.body || iframeDoc.documentElement;
          if (target) {
            target.appendChild(styleEl);
          }
        } catch (e) {
          console.error("DOM style injection failed:", e);
        }
      }
    };

    // Listen for navigation messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'navigate' && event.data.page) {
        setCurrentPage(event.data.page);
      }
    };

    window.addEventListener('message', handleMessage);

    // Load the current page
    loadPage(currentPage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [files, currentPage]);

  // If no HTML file, show placeholder
  const indexHtml = files['index.html'] || files['/home/user/index.html'] || files['/index.html'];
  if (!indexHtml) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <p className="text-gray-500">No HTML file found for preview</p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className={`border-0 ${className}`}
      title="HTML Preview"
      sandbox="allow-scripts allow-same-origin allow-modals"
      style={{ width: '100%', height: '100%' }}
    />
  );
}