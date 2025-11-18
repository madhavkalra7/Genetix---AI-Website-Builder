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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  
  const categories = ["All", "Business", "Portfolio", "Restaurant", "E-Commerce", "Blog", "Gaming", "Fitness", "Hospitality", "Entertainment", "Photography", "Travel", "Healthcare", "Legal", "Fashion"];
  
  // Filter by category AND search query
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

      {/* Header with Search Bar */}
      <div className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50 bg-black/80">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
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
          
          {/* Animated Search Bar */}
          <div className="relative w-full max-w-2xl mx-auto">
            <div 
              className={`
                relative flex items-center gap-3 px-5 py-3 
                bg-white/5 border border-white/10 rounded-full
                transition-all duration-300 ease-out
                ${isSearchFocused 
                  ? 'bg-white/10 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)] scale-105' 
                  : 'hover:bg-white/8 hover:border-white/20'
                }
              `}
            >
              {/* Search Icon with Animation */}
              <div className={`
                text-xl transition-all duration-300
                ${isSearchFocused 
                  ? 'text-purple-400 scale-110 animate-pulse' 
                  : 'text-gray-400'
                }
              `}>
                🔍
              </div>
              
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search templates by name, category, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="
                  flex-1 bg-transparent border-none outline-none 
                  text-white placeholder:text-gray-500
                  text-sm sm:text-base
                "
              />
              
              {/* Clear Button with Animation */}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="
                    text-gray-400 hover:text-white 
                    transition-all duration-200
                    hover:scale-110 hover:rotate-90
                  "
                >
                  ✕
                </button>
              )}
              
              {/* Results Count */}
              {searchQuery && (
                <div className="
                  px-3 py-1 bg-purple-500/20 rounded-full
                  text-xs text-purple-300 font-medium
                  animate-[fadeIn_0.3s_ease-out]
                ">
                  {filteredTemplates.length} {filteredTemplates.length === 1 ? 'result' : 'results'}
                </div>
              )}
            </div>
            
            {/* Animated Glow Effect */}
            {isSearchFocused && (
              <div className="
                absolute inset-0 -z-10
                bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20
                rounded-full blur-xl
                animate-[pulse_2s_ease-in-out_infinite]
              " />
            )}
          </div>
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
        {/* No Results Message */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-semibold mb-2">No templates found</h3>
            <p className="text-gray-400 mb-4">
              Try adjusting your search or filter criteria
            </p>
            <Button 
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Clear All Filters
            </Button>
          </div>
        )}
        
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
