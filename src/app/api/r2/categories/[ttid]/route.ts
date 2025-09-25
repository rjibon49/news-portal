// src/app/api/r2/categories/[ttid]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import {
  getCategoryByTTIdRepo,
  updateCategoryRepo,
  deleteCategoryRepo,
} from "@/db/repo/categories.repo";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  parent: z.number().int().nonnegative().nullable().optional(),
});

function parseId(params: { ttid?: string }) {
  const id = Number(params?.ttid || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function GET(_: Request, { params }: { params: { ttid: string } }) {
  try {
    const id = parseId(params);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const dto = await getCategoryByTTIdRepo(id);
    if (!dto) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { ttid: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await isAdmin(uid);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = parseId(params);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const payload = parsed.data;
    const dto = await updateCategoryRepo({
      term_taxonomy_id: id,
      name: payload.name,
      slug: payload.slug ? slugify(payload.slug) : undefined,
      description: payload.description,
      parent: payload.parent ?? undefined,
    });

    return NextResponse.json(dto);
  } catch (err: any) {
    const status = err?.status ?? 500;
    const message = status === 409 ? "Slug already in use." : err?.message || "Update failed";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_: Request, { params }: { params: { ttid: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const admin = await isAdmin(uid);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = parseId(params);
    if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    await deleteCategoryRepo(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status });
  }
}
