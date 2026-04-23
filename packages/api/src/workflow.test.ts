import assert from "node:assert/strict";
import test from "node:test";

import { TRPCError } from "@trpc/server";

import {
	mapWorkflowError,
	requireAgencyRole,
	resolveCurrentAgencyRecord,
} from "./workflow-core.ts";

const withNodeEnv = async (nodeEnv: string, callback: () => Promise<void>) => {
	const previousNodeEnv = process.env.NODE_ENV;
	process.env.NODE_ENV = nodeEnv;

	try {
		await callback();
	} finally {
		process.env.NODE_ENV = previousNodeEnv;
	}
};

test("resolveCurrentAgency rejects unauthenticated sessions", async () => {
	await assert.rejects(
		() =>
			resolveCurrentAgencyRecord({
				sessionUserId: null,
				nodeEnv: "development",
				getCurrentAgency: async () => null,
				createDefaultAgency: async () => null,
			}),
		(error) => error instanceof TRPCError && error.code === "UNAUTHORIZED",
	);
});

test("resolveCurrentAgency returns the existing agency", async () => {
	const currentAgency = {
		agency: { id: "agency_123" },
		membership: { role: "owner", userId: "user_123" },
	};

	await withNodeEnv("development", async () => {
		const result = await resolveCurrentAgencyRecord({
			sessionUserId: "user_123",
			nodeEnv: process.env.NODE_ENV,
			getCurrentAgency: async () => currentAgency,
			createDefaultAgency: async () => {
				throw new Error(
					"createDefaultAgency should not run when agency exists",
				);
			},
		});

		assert.equal(result, currentAgency);
	});
});

test("resolveCurrentAgency bootstraps a default agency in development", async () => {
	const currentAgency = {
		agency: { id: "agency_123" },
		membership: { role: "owner", userId: "user_123" },
	};

	await withNodeEnv("development", async () => {
		const result = await resolveCurrentAgencyRecord({
			sessionUserId: "user_123",
			nodeEnv: process.env.NODE_ENV,
			getCurrentAgency: async () => null,
			createDefaultAgency: async () => currentAgency,
		});

		assert.equal(result, currentAgency);
	});
});

test("resolveCurrentAgency forbids missing memberships in production", async () => {
	await withNodeEnv("production", async () => {
		await assert.rejects(
			() =>
				resolveCurrentAgencyRecord({
					sessionUserId: "user_123",
					nodeEnv: process.env.NODE_ENV,
					getCurrentAgency: async () => null,
					createDefaultAgency: async () => {
						throw new Error("createDefaultAgency should not run in production");
					},
				}),
			(error) => error instanceof TRPCError && error.code === "FORBIDDEN",
		);
	});
});

test("mapWorkflowError translates prefixed workflow errors", () => {
	assert.throws(
		() => mapWorkflowError(new Error("FORBIDDEN:blocked")),
		(error) =>
			error instanceof TRPCError &&
			error.code === "FORBIDDEN" &&
			error.message === "blocked",
	);
});

test("requireAgencyRole rejects disallowed roles", () => {
	assert.throws(
		() => requireAgencyRole("agent", ["owner", "manager"]),
		(error) => error instanceof TRPCError && error.code === "FORBIDDEN",
	);
});
