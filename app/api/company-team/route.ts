import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { FEATURE_CODES } from "@/lib/app-nav";
import type { TeamMemberRow } from "@/lib/company-team-service";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CreateBody = {
  email: string;
  full_name: string;
  phone?: string | null;
  role_id: string;
  company_id: string;
};

function getSiteUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return new URL(req.url).origin.replace(/\/$/, "");
}

function createAdminClient() {
  return createClient<Database>(url, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createUserClient(authHeader: string) {
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function assertCanManageCompany(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data: company } = await admin
    .from("companies")
    .select("id, owner_user_id")
    .eq("id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (company?.owner_user_id === userId) return true;

  const { data: mem } = await admin
    .from("company_users")
    .select("is_owner, role_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!mem) return false;
  if (mem.is_owner === true) return true;

  // Same rule as the Team nav item: role must include the company_team feature.
  if (!mem.role_id) return false;

  const { data: teamFeature } = await admin
    .from("features")
    .select("id")
    .eq("code", FEATURE_CODES.companyTeam)
    .eq("is_active", true)
    .maybeSingle();

  if (!teamFeature?.id) return false;

  const { data: rf } = await admin
    .from("role_features")
    .select("id")
    .eq("role_id", mem.role_id)
    .eq("feature_id", teamFeature.id)
    .maybeSingle();

  return !!rf;
}

function mapCompanyUsersToTeamRows(
  members: Array<Record<string, unknown>>,
  profileById: Map<string, Record<string, unknown>>
): TeamMemberRow[] {
  return members.map((m) => {
    const uid = m.user_id as string;
    const p = profileById.get(uid);
    const role = m.company_roles as { name: string } | null;
    const prof = p
      ? {
          full_name: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          phone: (p.phone as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
          is_active: Boolean(p.is_active),
          system_role: String(p.system_role ?? "member"),
          created_at: String(p.created_at ?? ""),
          updated_at: String(p.updated_at ?? ""),
        }
      : null;

    return {
      membershipId: m.id as string,
      userId: uid,
      companyId: m.company_id as string,
      roleId: m.role_id as string,
      roleName: role?.name ?? "—",
      isActive: Boolean(m.is_active),
      isOwner: Boolean(m.is_owner),
      invitedAt: (m.invited_at as string | null) ?? null,
      joinedAt: (m.joined_at as string | null) ?? null,
      profile: prof,
    };
  });
}

export async function GET(req: NextRequest) {
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY for company team API.",
      },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company_id = req.nextUrl.searchParams.get("company_id")?.trim();
  if (!company_id) {
    return NextResponse.json(
      { error: "Query parameter company_id is required." },
      { status: 400 }
    );
  }

  const supabaseUser = createUserClient(authHeader);
  const {
    data: { user },
    error: authErr,
  } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const allowed = await assertCanManageCompany(admin, user.id, company_id);
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have permission to view this company's team." },
      { status: 403 }
    );
  }

  const { data: rows, error } = await admin
    .from("company_users")
    .select(
      `
      id,
      user_id,
      company_id,
      role_id,
      is_active,
      is_owner,
      invited_at,
      joined_at,
      company_roles ( name )
    `
    )
    .eq("company_id", company_id)
    .order("joined_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to load team members." },
      { status: 400 }
    );
  }

  const members = (rows ?? []) as Array<Record<string, unknown>>;
  const userIds = members.map((m) => m.user_id as string).filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json({ members: [] as TeamMemberRow[] });
  }

  const { data: profiles, error: pErr } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, avatar_url, is_active, system_role, created_at, updated_at"
    )
    .in("id", userIds);

  if (pErr) {
    return NextResponse.json(
      { error: pErr.message ?? "Failed to load profiles." },
      { status: 400 }
    );
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as Record<string, unknown>])
  );

  const teamRows = mapCompanyUsersToTeamRows(members, profileById);
  return NextResponse.json({ members: teamRows });
}

export async function POST(req: NextRequest) {
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY for team member creation.",
      },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUser = createUserClient(authHeader);

  const {
    data: { user },
    error: authErr,
  } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  const full_name = body.full_name?.trim();
  const phone = body.phone?.trim() || null;
  const role_id = body.role_id;
  const company_id = body.company_id;

  if (!email || !full_name || !role_id || !company_id) {
    return NextResponse.json(
      { error: "email, full_name, role_id, and company_id are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const allowed = await assertCanManageCompany(admin, user.id, company_id);
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have permission to add users to this company." },
      { status: 403 }
    );
  }

  const { data: roleRow } = await admin
    .from("company_roles")
    .select("id")
    .eq("id", role_id)
    .eq("company_id", company_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!roleRow) {
    return NextResponse.json({ error: "Invalid role for this company." }, { status: 400 });
  }

  const siteUrl = getSiteUrl(req);
  const inviteRedirect = `${siteUrl}/auth/invite`;

  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name,
        phone: phone ?? "",
      },
      redirectTo: inviteRedirect,
    });

  if (inviteErr || !invited?.user) {
    return NextResponse.json(
      { error: inviteErr?.message ?? "Failed to send invitation." },
      { status: 400 }
    );
  }

  const newUserId = invited.user.id;
  const now = new Date().toISOString();

  const { error: profileErr } = await admin.from("user_profiles").upsert(
    {
      id: newUserId,
      full_name,
      email,
      phone,
      is_active: true,
      system_role: "member",
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: profileErr.message ?? "Failed to create user profile." },
      { status: 400 }
    );
  }

  const { error: cuErr } = await admin.from("company_users").insert({
    company_id,
    user_id: newUserId,
    role_id,
    is_active: true,
    is_owner: false,
    joined_at: now,
    invited_at: now,
  });

  if (cuErr) {
    await admin.from("user_profiles").delete().eq("id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: cuErr.message ?? "Failed to link user to company." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    user_id: newUserId,
    message: "Invitation sent. The user will set their password from the email link.",
  });
}
