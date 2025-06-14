import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

interface ColorPaletteProps {
  currentColor: string;
  onChange: (color: string) => void;
}

export default function ColorPalette({ currentColor, onChange }: ColorPaletteProps) {
  // Basic colors palette
  const basicColors = [
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Yellow", value: "#eab308" },
    { name: "Lime", value: "#84cc16" },
    { name: "Green", value: "#22c55e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Sky", value: "#0ea5e9" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Purple", value: "#a855f7" },
    { name: "Fuchsia", value: "#d946ef" },
    { name: "Pink", value: "#ec4899" },
    { name: "Rose", value: "#f43f5e" },
  ];

  // UI Colors (neutral tones)
  const uiColors = [
    { name: "Black", value: "#000000" },
    { name: "Gray 900", value: "#171717" },
    { name: "Gray 800", value: "#262626" },
    { name: "Gray 700", value: "#404040" },
    { name: "Gray 600", value: "#525252" },
    { name: "Gray 500", value: "#737373" },
    { name: "Gray 400", value: "#a3a3a3" },
    { name: "Gray 300", value: "#d4d4d4" },
    { name: "Gray 200", value: "#e5e5e5" },
    { name: "Gray 100", value: "#f5f5f5" },
    { name: "White", value: "#ffffff" },
  ];

  // Predefined color sets for quick selection
  const colorSets = [
    {
      name: "Social",
      colors: [
        { name: "Twitter", value: "#1DA1F2" },
        { name: "Facebook", value: "#1877F2" },
        { name: "Instagram", value: "#E4405F" },
        { name: "LinkedIn", value: "#0A66C2" },
      ],
    },
    {
      name: "Brand",
      colors: [
        { name: "Primary", value: "#3ecf8e" },
        { name: "Secondary", value: "#2563eb" },
        { name: "Accent", value: "#f59e0b" },
        { name: "Warning", value: "#ef4444" },
      ],
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex h-8 w-10 items-center justify-center p-0 border"
          style={{ backgroundColor: "transparent" }}
        >
          <div
            className="h-6 w-6 rounded-md shadow-md border border-gray-200"
            style={{ backgroundColor: currentColor }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Color</h4>
            <div className="grid grid-cols-8 gap-1">
              {basicColors.map((color) => (
                <button
                  key={color.value}
                  className={`h-6 w-6 rounded-md shadow-sm border ${
                    currentColor === color.value ? "ring-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onChange(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Neutral</h4>
            <div className="grid grid-cols-11 gap-1">
              {uiColors.map((color) => (
                <button
                  key={color.value}
                  className={`h-6 w-6 rounded-md shadow-sm border ${
                    color.value === "#ffffff" ? "border-gray-200" : ""
                  } ${currentColor === color.value ? "ring-2 ring-primary" : ""}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onChange(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Color Sets</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <span className="sr-only">Open color set menu</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {colorSets.map((set) => (
                    <DropdownMenuItem key={set.name} className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {set.colors.map((color) => (
                          <div
                            key={color.value}
                            className="h-4 w-4 rounded-sm"
                            style={{ backgroundColor: color.value }}
                          />
                        ))}
                      </div>
                      <span>{set.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {colorSets[0].colors.map((color) => (
                <button
                  key={color.value}
                  className={`h-8 rounded flex items-center justify-between px-2 ${
                    currentColor === color.value 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  }`}
                  style={{ backgroundColor: color.value, color: "#fff" }}
                  onClick={() => onChange(color.value)}
                >
                  <span className="text-xs">{color.name}</span>
                  {currentColor === color.value && <CheckIcon className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 