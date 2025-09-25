import { NextResponse } from 'next/server';
import CommentMeta from '@/db/models/CommentMeta';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const commentMetas = await CommentMeta.findAll();
        return NextResponse.json(commentMetas, { status: 200 });
    } catch (error) {
        console.error('Error fetching comment metas:', error);
        return NextResponse.json({ error: 'Failed to fetch comment metas' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newCommentMeta = await CommentMeta.create(body);
        return NextResponse.json(newCommentMeta, { status: 201 });
    } catch (error) {
        console.error('Error creating comment meta:', error);
        return NextResponse.json({ error: 'Failed to create comment meta' }, { status: 500 });
    }
}
