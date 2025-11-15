"use client";
import { templates } from "@/lib/templates";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  
  const categories = ["All", "Business", "Portfolio", "Restaurant", "E-Commerce", "Blog"];
  
  const filteredTemplates = selectedCategory === "All" 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const handleSelectTemplate = (templateId: string) => {
    router.push(`/?template=${templateId}`);
  };

  const handlePreview = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewTemplate(templateId);
  };

  const selectedTemplateData = previewTemplate 
    ? templates.find(t => t.id === previewTemplate) 
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Full Screen Preview Modal */}
      {previewTemplate && selectedTemplateData && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm">
          <div className="h-full flex flex-col">
            {/* Preview Header */}
            <div className="border-b border-white/10 bg-black/80 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-bold">{selectedTemplateData.name}</h2>
                  <p className="text-xs sm:text-sm text-gray-400">{selectedTemplateData.description}</p>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                  <Button 
                    onClick={() => {
                      setPreviewTemplate(null);
                      handleSelectTemplate(previewTemplate);
                    }}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-xs sm:text-sm"
                  >
                    Use Template
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setPreviewTemplate(null)}
                    className="flex-1 sm:flex-none border-white/20 hover:bg-white/10 text-xs sm:text-sm"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
            {/* Preview Content */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={selectedTemplateData.templateFile}
                className="w-full h-full border-0"
                title={`Preview of ${selectedTemplateData.name}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50 bg-black/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Website Templates
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">Choose a template to start building</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push("/")}
            className="border-white/20 hover:bg-white/10 w-full sm:w-auto"
          >
            Back to Home
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className={
                selectedCategory === category
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 border-0 whitespace-nowrap text-xs sm:text-sm"
                  : "border-white/20 hover:bg-white/10 whitespace-nowrap text-xs sm:text-sm"
              }
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="bg-white/5 border-white/10 hover:border-white/30 transition-all group overflow-hidden"
            >
              {/* Template Preview in Card */}
              <div 
                className="relative h-48 overflow-hidden cursor-pointer bg-black/20"
                onClick={() => handlePreview(template.id, {} as React.MouseEvent)}
              >
                <iframe
                  src={template.templateFile}
                  className="w-full border-0 pointer-events-none"
                  title={`Preview of ${template.name}`}
                  style={{ 
                    transform: 'scale(0.25)',
                    transformOrigin: 'top left',
                    width: '400%',
                    height: '768px'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white font-bold text-lg">👁️ Click to Preview</span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="px-3 py-1 bg-black/70 backdrop-blur-sm text-xs rounded-full border border-white/20">
                    {template.category}
                  </span>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-2">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.techStacks.slice(0, 3).map((tech) => (
                    <span 
                      key={tech} 
                      className="px-2 py-0.5 bg-white/10 text-xs rounded"
                    >
                      {tech.replace('-', ' ')}
                    </span>
                  ))}
                  {template.techStacks.length > 3 && (
                    <span className="px-2 py-0.5 bg-white/10 text-xs rounded">
                      +{template.techStacks.length - 3}
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTemplate(template.id);
                    }}
                  >
                    Use Template
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-white/20 hover:bg-white/10 text-xs sm:text-sm"
                    onClick={(e) => handlePreview(template.id, e)}
                  >
                    👁️ Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
