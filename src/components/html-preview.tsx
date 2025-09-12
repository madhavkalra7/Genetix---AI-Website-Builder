"use client";

import { useEffect, useRef, useState } from "react";

interface HTMLPreviewProps {
  files: { [path: string]: string };
  className?: string;
}

export function HTMLPreview({ files, className }: HTMLPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    const indexHtml = files['index.html'];
    
    if (!indexHtml) {
      setBlobUrl('');
      return;
    }

    // Start with the base HTML
    let combinedHTML = indexHtml;

    // Get all CSS files (handles different naming conventions)
    const cssFiles = Object.keys(files).filter(filename => 
      filename.endsWith('.css') && files[filename]
    );

    // Get all JS files (handles different naming conventions)  
    const jsFiles = Object.keys(files).filter(filename => 
      filename.endsWith('.js') && files[filename]
    );

    // Inject all CSS files
    cssFiles.forEach(cssFile => {
      const cssContent = files[cssFile];
      if (cssContent) {
        const cssInjection = `<style>\n/* ${cssFile} */\n${cssContent}\n</style>`;
        
        if (combinedHTML.includes('</head>')) {
          combinedHTML = combinedHTML.replace('</head>', `${cssInjection}\n</head>`);
        } else if (combinedHTML.includes('<head>')) {
          combinedHTML = combinedHTML.replace('<head>', `<head>\n${cssInjection}`);
        } else {
          // If no head tag, add it
          combinedHTML = combinedHTML.replace('<html>', `<html>\n<head>\n${cssInjection}\n</head>`);
        }
      }
    });

    // Inject all JS files
    jsFiles.forEach(jsFile => {
      const jsContent = files[jsFile];
      if (jsContent) {
        const jsInjection = `<script>\n/* ${jsFile} */\n${jsContent}\n</script>`;
        
        if (combinedHTML.includes('</body>')) {
          combinedHTML = combinedHTML.replace('</body>', `${jsInjection}\n</body>`);
        } else {
          combinedHTML += jsInjection;
        }
      }
    });

    // Create a blob URL for the combined HTML
    const blob = new Blob([combinedHTML], { type: 'text/html' });
    const newBlobUrl = URL.createObjectURL(blob);

    // Set the blob URL in state
    setBlobUrl(newBlobUrl);

    // Cleanup function to revoke the blob URL
    return () => {
      if (newBlobUrl) {
        URL.revokeObjectURL(newBlobUrl);
      }
    };
  }, [files]);

  // Update iframe source when blobUrl changes
  useEffect(() => {
    if (iframeRef.current && blobUrl) {
      iframeRef.current.src = blobUrl;
    }
  }, [blobUrl]);

  // Cleanup effect to clear iframe when component unmounts
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  // If no HTML file, show placeholder
  if (!files['index.html']) {
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
      sandbox="allow-scripts allow-same-origin"
      style={{ width: '100%', height: '100%' }}
    />
  );
}