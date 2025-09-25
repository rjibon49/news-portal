// src/app/api/r2/tags/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import { createTagRepo, listTagsRepo } from "@/db/repo/tags.repo";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  description: z.string().optional().default(""),
});

export async function GET() {
  try {
    const rows = await listTagsRepo();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(uid))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const { name, description } = parsed.data;
    const slug = slugify(parsed.data.slug || name);

    const dto = await createTagRepo({ name, slug, description });
    return NextResponse.json(dto, { status: 201 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = status === 409 ? "A tag with this slug already exists." : "Failed to create tag";
    return NextResponse.json({ error: message }, { status });
  }
}
