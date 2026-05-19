import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ModelDefinition,
  ModelPricingTier,
  ModelPrice,
  ModelCatalogEntry,
  CreateModelDefinitionInput,
  UpdateModelDefinitionInput,
  CreatePricingTierInput,
} from "@paperclipai/shared";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  Plus,
  Trash2,
} from "lucide-react";
import { modelsApi } from "@/api/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";

type TierWithPrices = ModelPricingTier & { prices: ModelPrice[] };
type FullModel = { model: ModelDefinition; pricingTiers: TierWithPrices[] };

const USAGE_TYPES = ["input", "output", "cached_input"] as const;
type UsageType = (typeof USAGE_TYPES)[number];

function CatalogPicker({
  entries,
  selectedId,
  loading,
  onSelect,
}: {
  entries: ModelCatalogEntry[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (entry: ModelCatalogEntry | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={loading}
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                <span>{selected.modelName}</span>
                <span className="ml-2 text-muted-foreground">
                  ({selected.provider})
                </span>
              </>
            ) : loading ? (
              "Loading catalog…"
            ) : (
              "None — fill in fields manually"
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            const v = value.toLowerCase();
            const s = search.toLowerCase();
            return v.includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ none manual"
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedId === null ? "opacity-100" : "opacity-0",
                  )}
                />
                None — fill in fields manually
              </CommandItem>
              {entries.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`${entry.modelName} ${entry.provider}`}
                  onSelect={() => {
                    onSelect(entry);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedId === entry.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{entry.modelName}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">
                    {entry.provider}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ModelFormDialog({
  open,
  initial,
  catalog,
  catalogLoading,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial?: ModelDefinition;
  catalog: ModelCatalogEntry[];
  catalogLoading: boolean;
  onClose: () => void;
  onSave: (data: CreateModelDefinitionInput, catalogEntry: ModelCatalogEntry | null) => void;
  saving: boolean;
}) {
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [matchPattern, setMatchPattern] = useState(initial?.matchPattern ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "tokens");
  const [catalogId, setCatalogId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setModelName(initial?.modelName ?? "");
      setMatchPattern(initial?.matchPattern ?? "");
      setProvider(initial?.provider ?? "");
      setUnit(initial?.unit ?? "tokens");
      setCatalogId(null);
    }
  }, [open, initial]);

  const handleCatalogSelect = (entry: ModelCatalogEntry | null) => {
    setCatalogId(entry?.id ?? null);
    if (entry) {
      setModelName(entry.modelName);
      setMatchPattern(`^${entry.modelName}$`);
      setProvider(entry.provider);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Model" : "Add Model"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Model Name</Label>
            <Input
              placeholder="claude-sonnet-4-5"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Match Pattern</Label>
            <Input
              placeholder="claude-sonnet-*"
              value={matchPattern}
              onChange={(e) => setMatchPattern(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Glob pattern matched against the model string in cost events.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Input
              placeholder="anthropic"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input
              placeholder="tokens"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          {!initial && (
            <div className="space-y-1.5">
              <Label>Copy pricing from existing model</Label>
              <CatalogPicker
                entries={catalog}
                selectedId={catalogId}
                loading={catalogLoading}
                onSelect={handleCatalogSelect}
              />
              <p className="text-xs text-muted-foreground">
                Pre-fills the fields below and creates a default pricing tier
                with the model&apos;s public per-token prices. Edit anything as
                needed before saving.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={
              saving ||
              !modelName.trim() ||
              !matchPattern.trim() ||
              !provider.trim()
            }
            onClick={() =>
              onSave(
                {
                  modelName: modelName.trim(),
                  matchPattern: matchPattern.trim(),
                  provider: provider.trim(),
                  unit: unit.trim() || "tokens",
                },
                catalog.find((e) => e.id === catalogId) ?? null,
              )
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TierFormDialog({
  open,
  modelId,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  modelId: string;
  initial?: TierWithPrices;
  onClose: () => void;
  onSave: (tier: CreatePricingTierInput, prices: Record<UsageType, string>) => void;
  saving: boolean;
}) {
  const buildInitialPrices = (): Record<UsageType, string> => {
    const map = { input: "", output: "", cached_input: "" } as Record<UsageType, string>;
    for (const u of USAGE_TYPES) {
      const p = initial?.prices.find((x) => x.usageType === u);
      map[u] = p?.pricePerUnit ?? "";
    }
    return map;
  };

  const [tierName, setTierName] = useState(initial?.tierName ?? "");
  const [priority, setPriority] = useState(String(initial?.priority ?? 1));
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [prices, setPrices] = useState<Record<UsageType, string>>(buildInitialPrices);

  useEffect(() => {
    if (open) {
      setTierName(initial?.tierName ?? "");
      setPriority(String(initial?.priority ?? 1));
      setIsDefault(initial?.isDefault ?? false);
      setPrices(buildInitialPrices());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Pricing Tier" : "Add Pricing Tier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tier Name</Label>
            <Input
              placeholder="Standard"
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Input
                type="number"
                min={0}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Lower = higher priority.</p>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="tier-default"
                type="checkbox"
                className="h-4 w-4"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <Label htmlFor="tier-default">Default tier</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prices (per token)</Label>
            {USAGE_TYPES.map((u) => (
              <div key={u} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-xs text-muted-foreground capitalize">
                  {u.replace("_", " ")}
                </span>
                <Input
                  placeholder="0.000000"
                  value={prices[u]}
                  onChange={(e) =>
                    setPrices((p) => ({ ...p, [u]: e.target.value }))
                  }
                />
                <span className="text-xs text-muted-foreground">USD</span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !tierName.trim()}
            onClick={() =>
              onSave(
                {
                  modelId,
                  tierName: tierName.trim(),
                  priority: Number(priority) || 1,
                  isDefault,
                },
                prices,
              )
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InstanceModelsSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [modelDialog, setModelDialog] = useState<{
    open: boolean;
    editing?: ModelDefinition;
  }>({ open: false });
  const [tierDialog, setTierDialog] = useState<{
    open: boolean;
    modelId: string;
    editing?: TierWithPrices;
  }>({ open: false, modelId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    label: string;
    onConfirm: () => void;
  }>({ open: false, label: "", onConfirm: () => {} });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Instance Settings" }, { label: "Models" }]);
  }, [setBreadcrumbs]);

  const modelsQuery = useQuery({
    queryKey: queryKeys.instance.models,
    queryFn: () => modelsApi.listWithPricing(),
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.instance.modelsCatalog,
    queryFn: () => modelsApi.listCatalog(),
    staleTime: 1000 * 60 * 60,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.instance.models });
  const handleError = (e: unknown) =>
    setActionError(e instanceof Error ? e.message : "An error occurred.");
  const closeDeleteConfirm = () =>
    setDeleteConfirm({ open: false, label: "", onConfirm: () => {} });

  const createModel = useMutation({
    mutationFn: async ({
      data,
      catalogEntry,
    }: {
      data: CreateModelDefinitionInput;
      catalogEntry: ModelCatalogEntry | null;
    }) => {
      const created = await modelsApi.createDefinition(data);
      if (catalogEntry) {
        const tier = await modelsApi.createTier({
          modelId: created.id,
          tierName: "Standard",
          priority: 1,
          isDefault: true,
        });
        const priceWrites: Array<{ usageType: UsageType; pricePerUnit: string }> = [];
        if (catalogEntry.inputCostPerToken)
          priceWrites.push({ usageType: "input", pricePerUnit: catalogEntry.inputCostPerToken });
        if (catalogEntry.outputCostPerToken)
          priceWrites.push({ usageType: "output", pricePerUnit: catalogEntry.outputCostPerToken });
        if (catalogEntry.cachedInputCostPerToken)
          priceWrites.push({
            usageType: "cached_input",
            pricePerUnit: catalogEntry.cachedInputCostPerToken,
          });
        await Promise.all(
          priceWrites.map((p) =>
            modelsApi.upsertPrice({
              pricingTierId: tier.id,
              usageType: p.usageType,
              pricePerUnit: p.pricePerUnit,
              currency: "USD",
            }),
          ),
        );
      }
      return created;
    },
    onSuccess: () => {
      setModelDialog({ open: false });
      setActionError(null);
      void invalidate();
    },
    onError: handleError,
  });

  const updateModel = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateModelDefinitionInput }) =>
      modelsApi.updateDefinition(id, input),
    onSuccess: () => {
      setModelDialog({ open: false });
      setActionError(null);
      void invalidate();
    },
    onError: handleError,
  });

  const deleteModel = useMutation({
    mutationFn: modelsApi.deleteDefinition,
    onSuccess: () => {
      closeDeleteConfirm();
      setActionError(null);
      void invalidate();
    },
    onError: handleError,
  });

  const saveTier = useMutation({
    mutationFn: async ({
      tier,
      prices,
      tierId,
    }: {
      tier: CreatePricingTierInput;
      prices: Record<UsageType, string>;
      tierId?: string;
    }) => {
      const saved = tierId
        ? await modelsApi.updateTier(tierId, {
            tierName: tier.tierName,
            priority: tier.priority,
            isDefault: tier.isDefault,
          })
        : await modelsApi.createTier(tier);
      const priceUpdates = USAGE_TYPES.filter(
        (u) => prices[u] !== "" && /^\d+(\.\d+)?$/.test(prices[u]),
      ).map((u) =>
        modelsApi.upsertPrice({
          pricingTierId: saved.id,
          usageType: u,
          pricePerUnit: prices[u],
          currency: "USD",
        }),
      );
      await Promise.all(priceUpdates);
    },
    onSuccess: () => {
      setTierDialog({ open: false, modelId: "" });
      setActionError(null);
      void invalidate();
    },
    onError: handleError,
  });

  const deleteTier = useMutation({
    mutationFn: modelsApi.deleteTier,
    onSuccess: () => {
      closeDeleteConfirm();
      setActionError(null);
      void invalidate();
    },
    onError: handleError,
  });

  const toggleExpand = (id: string) =>
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const models: FullModel[] = (modelsQuery.data ?? []).filter(
    (m): m is FullModel => m !== null,
  );

  if (modelsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading…</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Models</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Define model pricing for cost tracking. Match patterns are matched against
            the model string in cost events.
          </p>
        </div>
        <Button size="sm" onClick={() => setModelDialog({ open: true })}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Model
        </Button>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {models.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No models defined. Click &quot;Add Model&quot; to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {models.map(({ model, pricingTiers }) => {
            const expanded = expandedIds.has(model.id);
            return (
              <Card key={model.id}>
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => toggleExpand(model.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{model.modelName}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {model.provider}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {model.matchPattern}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModelDialog({ open: true, editing: model })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setDeleteConfirm({
                            open: true,
                            label: `Delete model "${model.modelName}"? This will also delete all its pricing tiers and prices.`,
                            onConfirm: () => deleteModel.mutate(model.id),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-border">
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Pricing Tiers
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setTierDialog({ open: true, modelId: model.id })
                          }
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add Tier
                        </Button>
                      </div>
                      {pricingTiers.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
                          No pricing tiers yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {pricingTiers.map((tier) => (
                            <div
                              key={tier.id}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {tier.tierName}
                                  </span>
                                  {tier.isDefault && (
                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                      default
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    priority {tier.priority}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                  {USAGE_TYPES.map((u) => {
                                    const p = tier.prices.find(
                                      (x) => x.usageType === u,
                                    );
                                    return (
                                      <span
                                        key={u}
                                        className="text-xs text-muted-foreground"
                                      >
                                        <span className="capitalize">
                                          {u.replace("_", " ")}
                                        </span>
                                        : {p ? `$${p.pricePerUnit}` : "—"}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setTierDialog({
                                      open: true,
                                      modelId: model.id,
                                      editing: tier,
                                    })
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      open: true,
                                      label: `Delete tier "${tier.tierName}"?`,
                                      onConfirm: () => deleteTier.mutate(tier.id),
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ModelFormDialog
        open={modelDialog.open}
        initial={modelDialog.editing}
        catalog={catalogQuery.data ?? []}
        catalogLoading={catalogQuery.isLoading}
        onClose={() => setModelDialog({ open: false })}
        saving={createModel.isPending || updateModel.isPending}
        onSave={(data, catalogEntry) => {
          if (modelDialog.editing) {
            updateModel.mutate({ id: modelDialog.editing.id, input: data });
          } else {
            createModel.mutate({ data, catalogEntry });
          }
        }}
      />

      <TierFormDialog
        open={tierDialog.open}
        modelId={tierDialog.modelId}
        initial={tierDialog.editing}
        onClose={() => setTierDialog({ open: false, modelId: "" })}
        saving={saveTier.isPending}
        onSave={(tier, prices) =>
          saveTier.mutate({ tier, prices, tierId: tierDialog.editing?.id })
        }
      />

      <Dialog
        open={deleteConfirm.open}
        onOpenChange={(v) => !v && closeDeleteConfirm()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">{deleteConfirm.label}</p>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteConfirm}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteConfirm.onConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
