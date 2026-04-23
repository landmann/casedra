import type { AgencyRole } from "@casedra/types";
import { TRPCError } from "@trpc/server";

const workflowErrorCodes = {
	STALE_STATE: "CONFLICT",
	INVALID_STATE_TRANSITION: "BAD_REQUEST",
	INVALID_ASSIGNMENT: "BAD_REQUEST",
	INVALID_OWNERSHIP: "CONFLICT",
	VALIDATION: "BAD_REQUEST",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	UNAUTHORIZED: "UNAUTHORIZED",
	INTERNAL: "INTERNAL_SERVER_ERROR",
} as const;

type WorkflowErrorCode = keyof typeof workflowErrorCodes;

export const mapWorkflowError = (error: unknown): never => {
	if (error instanceof TRPCError) {
		throw error;
	}

	if (!(error instanceof Error)) {
		throw error;
	}

	const matchedCode = Object.keys(workflowErrorCodes).find((candidate) =>
		error.message.includes(`${candidate}:`),
	) as WorkflowErrorCode | undefined;

	if (!matchedCode) {
		throw error;
	}

	const [, ...messageParts] = error.message.split(`${matchedCode}:`);
	const message =
		messageParts.join(`${matchedCode}:`).trim() || "Workflow request failed";

	throw new TRPCError({
		code: workflowErrorCodes[matchedCode],
		message,
	});
};

export const resolveCurrentAgencyRecord = async <T>(options: {
	createDefaultAgency: () => Promise<T>;
	getCurrentAgency: () => Promise<T | null>;
	nodeEnv: string | undefined;
	sessionUserId: string | null | undefined;
}) => {
	if (!options.sessionUserId) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	let currentAgency = await options.getCurrentAgency();

	if (!currentAgency && options.nodeEnv !== "production") {
		currentAgency = await options.createDefaultAgency();
	}

	if (!currentAgency) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "No agency membership is available for this user",
		});
	}

	return currentAgency;
};

export const requireAgencyRole = (
	role: AgencyRole,
	allowedRoles: AgencyRole[],
) => {
	if (!allowedRoles.includes(role)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not have permission to perform this workflow action",
		});
	}
};
