"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DroppableProvided,
  type DraggableProvided,
  type DropResult,
} from "@hello-pangea/dnd";
import { Trash2, GripVertical } from "lucide-react";
import * as z from "zod";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";

const supabase = createClient();

const settingsSchema = z.object({
  formula: z.enum(["surface_area_to_volume", "features_count", "custom"]),
  k_factor: z.coerce.number().min(0.1).max(10),
  min_volume: z.coerce.number().min(0).optional(),
  min_surface_area: z.coerce.number().min(0).optional(),
  features_weight: z.coerce.number().min(0).max(1).optional(),
  custom_formula: z.string().optional(),
});

// const bracketSchema = z.object({
//   id: z.string().uuid().optional(),
//   name: z.string().min(1),
//   description: z.string().optional(),
//   min_value: z.coerce.number().min(0),
//   max_value: z.coerce.number().nullable(),
//   multiplier: z.coerce.number().min(1),
//   sort_order: z.number()
// });

export default function ComplexityPage() {
  const params = useParams();
  const machineId = params?.id as string;
  const [settings, setSettings] = useState<z.infer<
    typeof settingsSchema
  > | null>(null);
  const [brackets, setBrackets] = useState<z.infer<typeof bracketSchema>[]>([]);

  // Simulator state
  const [volume, setVolume] = useState(100);
  const [surfaceArea, setSurfaceArea] = useState(200);
  const [features, setFeatures] = useState(5);
  const [simulatedMultiplier, setSimulatedMultiplier] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings || undefined,
  });

  const loadData = useCallback(async () => {
    if (!machineId) return;

    const { data: settingsData } = await supabase
      .from("complexity_settings")
      .select("*")
      .eq("machine_id", machineId)
      .single();

    if (settingsData) {
      setSettings(settingsData);
    }

    const { data: bracketsData } = await supabase
      .from("complexity_brackets")
      .select("*")
      .eq("machine_id", machineId)
      .order("sort_order");

    if (bracketsData) {
      setBrackets(bracketsData);
    }
  }, [machineId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onSaveSettings = async (data: any) => {
    const { error } = await supabase.from("complexity_settings").upsert({
      ...data,
      machine_id: machineId,
    });

    if (error) {
      toast({
        title: "Error saving settings",
        description: error.message,
      });
    } else {
      toast({
        title: "Settings saved successfully",
      });
      loadData();
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(brackets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update sort order
    const updatedBrackets = items.map((item, index) => ({
      ...item,
      sort_order: index,
    }));

    setBrackets(updatedBrackets);

    // Save new order to database
    const { error } = await supabase.from("complexity_brackets").upsert(
      updatedBrackets.map(({ id, sort_order }) => ({
        id,
        machine_id: machineId,
        sort_order,
      })),
    );

    if (error) {
      toast({
        title: "Error updating order",
        description: error.message,
      });
    }
  };

  const addBracket = async () => {
    const newBracket = {
      machine_id: machineId,
      name: "New Bracket",
      min_value: 0,
      max_value: null,
      multiplier: 1,
      sort_order: brackets.length,
    };

    const { error } = await supabase
      .from("complexity_brackets")
      .insert(newBracket);

    if (error) {
      toast({
        title: "Error adding bracket",
        description: error.message,
      });
    } else {
      loadData();
    }
  };

  const updateBracket = async (
    id: string,
    data: Partial<z.infer<typeof bracketSchema>>,
  ) => {
    const { error } = await supabase
      .from("complexity_brackets")
      .update(data)
      .eq("id", id);

    if (error) {
      toast({
        title: "Error updating bracket",
        description: error.message,
      });
    } else {
      loadData();
    }
  };

  const deleteBracket = async (id: string) => {
    const { error } = await supabase
      .from("complexity_brackets")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting bracket",
        description: error.message,
      });
    } else {
      loadData();
    }
  };

  // Simulate complexity
  useEffect(() => {
    if (!settings || !brackets.length) return;

    let complexity: number;

    switch (settings.formula) {
      case "surface_area_to_volume":
        complexity =
          (surfaceArea / Math.pow(volume, 2 / 3)) * settings.k_factor;
        break;
      case "features_count":
        complexity = features * settings.k_factor;
        break;
      case "custom":
        // Evaluate custom formula if needed
        complexity = surfaceArea / volume;
        break;
      default:
        complexity = 0;
    }

    // Find matching bracket
    const bracket = brackets.find(
      (b) =>
        complexity >= (b.min_value || 0) &&
        (b.max_value === null || complexity <= b.max_value),
    );

    setSimulatedMultiplier(bracket?.multiplier || 1);
  }, [settings, brackets, volume, surfaceArea, features]);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Complexity Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSaveSettings)} className="space-y-4">
              <div className="space-y-2">
                <Label>Formula Type</Label>
                <Select
                  {...register("formula")}
                  value={settings?.formula}
                  onValueChange={(value: any) =>
                    setSettings((s) => ({ ...s!, formula: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select formula type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surface_area_to_volume">
                      Surface Area to Volume
                    </SelectItem>
                    <SelectItem value="features_count">
                      Features Count
                    </SelectItem>
                    <SelectItem value="custom">Custom Formula</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>K-Factor</Label>
                <Input type="number" step="0.1" {...register("k_factor")} />
                {errors.k_factor && (
                  <p className="text-sm text-red-500">
                    {errors.k_factor.message}
                  </p>
                )}
              </div>

              <Button type="submit">Save Settings</Button>
            </form>
          </CardContent>
        </Card>

        {/* Simulator */}
        <Card>
          <CardHeader>
            <CardTitle>Complexity Simulator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Volume (cm³)</Label>
                <Input
                  type="number"
                  value={volume}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setVolume(parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Surface Area (cm²)</Label>
                <Input
                  type="number"
                  value={surfaceArea}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSurfaceArea(parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Features Count</Label>
                <Input
                  type="number"
                  value={features}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFeatures(parseInt(e.target.value) || 0)
                  }
                />
              </div>

              <Separator />

              <div className="pt-4">
                <p className="text-lg font-semibold">
                  Complexity Multiplier: {simulatedMultiplier.toFixed(2)}x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brackets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Complexity Brackets</CardTitle>
          <Button onClick={addBracket}>Add Bracket</Button>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="brackets">
              {(droppableProvided: DroppableProvided) => (
                <div
                  {...droppableProvided.droppableProps}
                  ref={droppableProvided.innerRef}
                >
                  {brackets.map((bracket, index) => (
                    <Draggable
                      key={bracket.id}
                      draggableId={bracket.id!}
                      index={index}
                    >
                      {(draggableProvided: DraggableProvided) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          className="flex items-center gap-4 p-4 mb-2 bg-secondary/50 rounded-lg"
                        >
                          <div {...draggableProvided.dragHandleProps}>
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <div className="flex-1 grid grid-cols-6 gap-4">
                            <Input
                              placeholder="Name"
                              value={bracket.name}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateBracket(bracket.id!, {
                                  name: e.target.value,
                                })
                              }
                              className="col-span-2"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Min Value"
                              value={bracket.min_value}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateBracket(bracket.id!, {
                                  min_value: parseFloat(e.target.value),
                                })
                              }
                            />
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Max Value"
                              value={bracket.max_value || ""}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateBracket(bracket.id!, {
                                  max_value: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                })
                              }
                            />
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Multiplier"
                              value={bracket.multiplier}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateBracket(bracket.id!, {
                                  multiplier: parseFloat(e.target.value),
                                })
                              }
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteBracket(bracket.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>
    </div>
  );
}
