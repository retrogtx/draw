import useWhiteboardStore from "@/app/store/useWhiteboardStore";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  Square, 
  RectangleHorizontal, 
  Type, 
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import ColorPalette from './ColorPalette';

export type DrawingTool = 'pencil' | 'square' | 'rectangle' | 'text';

interface ToolbarProps {
  selectedTool: DrawingTool;
  setSelectedTool: (tool: DrawingTool) => void;
}

const Toolbar = ({ selectedTool, setSelectedTool }: ToolbarProps) => {
  const { currentColor, setCurrentColor } = useWhiteboardStore();
  
  const tools = [
    { name: 'pencil', icon: <Pencil size={18} />, label: "Pencil" },
    { name: 'square', icon: <Square size={18} />, label: "Square" },
    { name: 'rectangle', icon: <RectangleHorizontal size={18} />, label: "Rectangle" },
    { name: 'text', icon: <Type size={18} />, label: "Text" },
  ] as const;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg border shadow-2xl">
        {/* Drawing Tools */}
        <div className="flex gap-1.5">
          {tools.map((tool) => (
            <Button
              key={tool.name}
              variant={selectedTool === tool.name ? "default" : "outline"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setSelectedTool(tool.name)}
              title={tool.label}
            >
              {tool.icon}
              <span className="sr-only">{tool.label}</span>
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Color Picker */}
        <div className="px-0.5">
          <ColorPalette 
            currentColor={currentColor} 
            onChange={setCurrentColor} 
          />
        </div>
      </div>
    </div>
  );
};

export default Toolbar; 