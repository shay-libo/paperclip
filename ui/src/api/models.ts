import type {
  CreateModelDefinitionInput,
  UpdateModelDefinitionInput,
  CreatePricingTierInput,
  UpdatePricingTierInput,
  CreateModelPriceInput,
  ModelWithPricing,
  ModelDefinition,
  ModelPricingTier,
  ModelPrice,
  ModelCatalogEntry,
} from "@paperclipai/shared";
import { api } from "./client";

export const modelsApi = {
  listWithPricing: () =>
    api.get<(ModelWithPricing | null)[]>("/instance/settings/models/definitions"),

  createDefinition: (input: CreateModelDefinitionInput) =>
    api.post<ModelDefinition>("/instance/settings/models/definitions", input),

  updateDefinition: (id: string, input: UpdateModelDefinitionInput) =>
    api.patch<ModelDefinition>(`/instance/settings/models/definitions/${id}`, input),

  deleteDefinition: (id: string) =>
    api.delete<void>(`/instance/settings/models/definitions/${id}`),

  createTier: (input: CreatePricingTierInput) =>
    api.post<ModelPricingTier>("/instance/settings/models/tiers", input),

  updateTier: (id: string, input: UpdatePricingTierInput) =>
    api.patch<ModelPricingTier>(`/instance/settings/models/tiers/${id}`, input),

  deleteTier: (id: string) =>
    api.delete<void>(`/instance/settings/models/tiers/${id}`),

  upsertPrice: (input: CreateModelPriceInput) =>
    api.put<ModelPrice>("/instance/settings/models/prices", input),

  deletePrice: (id: string) =>
    api.delete<void>(`/instance/settings/models/prices/${id}`),

  listCatalog: () =>
    api.get<ModelCatalogEntry[]>("/instance/settings/models/catalog"),
};
