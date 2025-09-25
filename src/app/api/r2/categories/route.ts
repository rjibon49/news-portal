// src/app/api/categories/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import { createCategoryRepo, listCategoriesRepo } from "@/db/repo/categories.repo";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  description: z.string().optional().default(""),
  parent: z.number().int().nonnegative().optional().nullable(),
});

export async function GET() {
  try {
    const rows = await listCategoriesRepo();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions); // ✅ IMPORTANT
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await isAdmin(uid);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const { name, description, parent } = parsed.data;
    const slug = slugify(parsed.data.slug || name);

    const dto = await createCategoryRepo({ name, slug, description, parent: parent ?? null });
    return NextResponse.json(dto, { status: 201 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = status === 409 ? "A category with this slug already exists." : "Failed to create category";
    return NextResponse.json({ error: message }, { status });
  }
}