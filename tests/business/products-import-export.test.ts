import assert from "node:assert/strict";
import test from "node:test";

import { GET as exportProducts } from "../../src/app/api/products/export/route";
import {
  GET as listProducts,
  POST as createProduct,
} from "../../src/app/api/products/route";
import { businessRequest } from "../helpers/business-context";
import { contextA, contextB } from "../repositories/contract";

test("product creation, listing and export are tenant isolated", async () => {
  const createdResponse = await createProduct(
    businessRequest(
      "http://localhost/api/products",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tenant A Charger",
          modelNo: "TA-65W",
          costPrice: 18.5,
          unit: "pcs",
          moq: 20,
        }),
      },
      contextA,
    ),
  );
  assert.equal(createdResponse.status, 201);

  const companyAResponse = await listProducts(
    businessRequest("http://localhost/api/products", {}, contextA),
  );
  const companyBResponse = await listProducts(
    businessRequest("http://localhost/api/products", {}, contextB),
  );
  const companyAProducts = (await companyAResponse.json()) as { name: string }[];
  const companyBProducts = (await companyBResponse.json()) as { name: string }[];
  assert.equal(companyAProducts.some((item) => item.name === "Tenant A Charger"), true);
  assert.deepEqual(companyBProducts, []);

  const companyAExport = await exportProducts(
    businessRequest("http://localhost/api/products/export", {}, contextA),
  );
  const companyBExport = await exportProducts(
    businessRequest("http://localhost/api/products/export", {}, contextB),
  );
  assert.match(await companyAExport.text(), /Tenant A Charger/);
  assert.doesNotMatch(await companyBExport.text(), /Tenant A Charger/);
});
