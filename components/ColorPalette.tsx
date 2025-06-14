import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";


interface ColorPaletteProps {
  currentColor: string;
  onChange: (color: string) => void;
}

export default function ColorPalette({ currentColor, onChange }: ColorPaletteProps) {
  const colors = [
    // Basic colors
    "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981",
    "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
    "#d946ef", "#ec4899", "#f43f5e",
    // Neutral tones
    "#000000", "#171717", "#262626", "#404040", "#525252", "#737373", "#a3a3a3",
    "#d4d4d4", "#e5e5e5", "#f5f5f5", "#ffffff",
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex h-8 w-8 items-center justify-center p-0"
        >
          <div
            className="h-6 w-6 rounded-full shadow-md border"
            style={{ backgroundColor: currentColor }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="center">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm leading-none">Color</h4>
            <div className="grid grid-cols-9 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  className={`h-6 w-6 rounded-full shadow-sm border ${
                    color === "#ffffff" ? "border-gray-200" : ""
                  } ${currentColor.toLowerCase() === color.toLowerCase() ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => onChange(color)}
                />
              ))}
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm leading-none">Custom Color</h4>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={currentColor}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 text-sm"
                placeholder="#RRGGBB"
              />
              <Input
                type="color"
                value={currentColor}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-10 p-1"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 