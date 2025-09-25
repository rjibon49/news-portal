import { NextResponse } from 'next/server';
import PostMeta from '@/db/models/PostMeta';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const postMetas = await PostMeta.findAll();
        return NextResponse.json(postMetas, { status: 200 });
    } catch (error) {
        console.error('Error fetching post metas:', error);
        return NextResponse.json({ error: 'Failed to fetch post metas' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newPostMeta = await PostMeta.create(body);
        return NextResponse.json(newPostMeta, { status: 201 });
    } catch (error) {
        console.error('Error creating post meta:', error);
        return NextResponse.json({ error: 'Failed to create post meta' }, { status: 500 });
    }
}
