// src/app/api/r2/post/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdmin } from "@/lib/auth/isAdmin";
import { slugify } from "@/lib/slugify";
import { createPostRepo } from "@/db/repo/posts.repo";

export const runtime = "nodejs";

const CreatePostSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional().default(""),
  excerpt: z.string().optional().default(""),
  slug: z.string().optional(),
  status: z.enum(["publish", "draft", "pending"]).optional().default("draft"),
  categories: z.array(z.number().int().positive()).optional().default([]),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions); // ✅ IMPORTANT
    const uid = Number((session as any)?.user?.id || 0);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await isAdmin(uid);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreatePostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const { title, content, excerpt, status, categories } = parsed.data;
    const out = await createPostRepo({
      authorId: uid,
      title,
      content,
      excerpt,
      status,
      slug: slugify(parsed.data.slug || title),
      postType: "post",
      categories,
    });

    return NextResponse.json(out, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
