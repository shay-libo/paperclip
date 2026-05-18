import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createModelDefinitionSchema,
  updateModelDefinitionSchema,
  createPricingTierSchema,
  updatePricingTierSchema,
  createModelPriceSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { modelService, modelCatalogService } from "../services/index.js";
import { assertBoardOrgAccess, assertInstanceAdmin } from "./authz.js";

export function modelRoutes(db: Db) {
  const router = Router();
  const models = modelService(db);

  router.get("/instance/settings/models/definitions", async (req, res) => {
    assertBoardOrgAccess(req);
    const defs = await models.listDefinitionsWithPricing();
    res.json(defs);
  });

  router.get("/instance/settings/models/catalog", async (req, res) => {
    assertBoardOrgAccess(req);
    const entries = await modelCatalogService.list();
    res.json(entries);
  });

  router.post(
    "/instance/settings/models/definitions",
    validate(createModelDefinitionSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const model = await models.createDefinition(req.body);
      res.status(201).json(model);
    },
  );

  router.patch(
    "/instance/settings/models/definitions/:id",
    validate(updateModelDefinitionSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const model = await models.updateDefinition(req.params.id as string, req.body);
      if (!model) {
        res.status(404).json({ error: "Model definition not found" });
        return;
      }
      res.json(model);
    },
  );

  router.delete("/instance/settings/models/definitions/:id", async (req, res) => {
    assertInstanceAdmin(req);
    const model = await models.deleteDefinition(req.params.id as string);
    if (!model) {
      res.status(404).json({ error: "Model definition not found" });
      return;
    }
    res.status(204).end();
  });

  router.post(
    "/instance/settings/models/tiers",
    validate(createPricingTierSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const tier = await models.createTier(req.body);
      res.status(201).json(tier);
    },
  );

  router.patch(
    "/instance/settings/models/tiers/:id",
    validate(updatePricingTierSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const tier = await models.updateTier(req.params.id as string, req.body);
      if (!tier) {
        res.status(404).json({ error: "Pricing tier not found" });
        return;
      }
      res.json(tier);
    },
  );

  router.delete("/instance/settings/models/tiers/:id", async (req, res) => {
    assertInstanceAdmin(req);
    const tier = await models.deleteTier(req.params.id as string);
    if (!tier) {
      res.status(404).json({ error: "Pricing tier not found" });
      return;
    }
    res.status(204).end();
  });

  router.put(
    "/instance/settings/models/prices",
    validate(createModelPriceSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const price = await models.upsertPrice(req.body);
      res.json(price);
    },
  );

  router.delete("/instance/settings/models/prices/:id", async (req, res) => {
    assertInstanceAdmin(req);
    const price = await models.deletePrice(req.params.id as string);
    if (!price) {
      res.status(404).json({ error: "Price not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
