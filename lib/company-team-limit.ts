/**
 * Company team seat limits: plan `max_users` plus optional `max_users_override`.
 */

export type CompanyTeamSeatUsage = {
  currentCount: number;
  planMaxUsers: number;
  maxUsersOverride: number | null;
  effectiveLimit: number;
  canInvite: boolean;
  atLimit: boolean;
};

export function resolveCompanyTeamSeatLimit(
  planMaxUsers: number,
  maxUsersOverride: number | null | undefined,
): number {
  const base = Math.max(0, Math.floor(Number(planMaxUsers)) || 0);
  if (maxUsersOverride == null) return base;
  const extra = Math.max(0, Math.floor(Number(maxUsersOverride)) || 0);
  return base + extra;
}

export function buildCompanyTeamSeatUsage(input: {
  planMaxUsers: number;
  maxUsersOverride: number | null | undefined;
  currentMemberCount: number;
}): CompanyTeamSeatUsage {
  const currentCount = Math.max(0, Math.floor(input.currentMemberCount) || 0);
  const planMaxUsers = Math.max(0, Math.floor(Number(input.planMaxUsers)) || 0);
  const maxUsersOverride =
    input.maxUsersOverride == null
      ? null
      : Math.max(0, Math.floor(Number(input.maxUsersOverride)) || 0);
  const effectiveLimit = resolveCompanyTeamSeatLimit(
    planMaxUsers,
    maxUsersOverride,
  );
  return {
    currentCount,
    planMaxUsers,
    maxUsersOverride,
    effectiveLimit,
    canInvite: currentCount < effectiveLimit,
    atLimit: currentCount >= effectiveLimit,
  };
}

export function formatTeamInviteLimitMessage(usage: CompanyTeamSeatUsage): string {
  const limit = usage.effectiveLimit;
  const base = `Team member limit reached (${usage.currentCount} of ${limit} seats used).`;
  if (usage.maxUsersOverride != null && usage.maxUsersOverride > 0) {
    return `${base} Your plan allows ${usage.planMaxUsers} users plus ${usage.maxUsersOverride} extra (${limit} total). Remove a member or upgrade your plan to invite more.`;
  }
  return `${base} Your plan allows ${limit} user${limit === 1 ? "" : "s"}. Remove a member or upgrade your plan to invite more.`;
}
