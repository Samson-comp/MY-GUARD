import test from "node:test";
import assert from "node:assert/strict";
import { hireRequestSchema, profileUpdateSchema } from "../src/validation.js";

test("hire request accepts the public form fields with an optional budget", () => {
    const request = hireRequestSchema.parse({
        professionalId: "123e4567-e89b-42d3-a456-426614174000",
        customerName: "Test Customer",
        email: "customer@example.test",
        phone: "+254 700 000 000",
        reason: "Event security",
        budgetKes: null,
        consent: true
    });

    assert.equal(request.budgetKes, null);
    assert.equal(request.email, "customer@example.test");
});

test("hire request validation gives a field-specific UUID error", () => {
    const result = hireRequestSchema.safeParse({
        professionalId: "",
        customerName: "Test Customer",
        email: "customer@example.test",
        phone: "+254 700 000 000",
        reason: "Event security",
        budgetKes: null,
        consent: true
    });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, "Invalid UUID");
});

test("profile moderation accepts pending, published, and hidden states", () => {
    for (const status of ["pending", "published", "hidden"]) {
        assert.equal(profileUpdateSchema.parse({ status }).status, status);
    }
});
