import { NextResponse } from 'next/server';
import Comment from '@/db/models/Comment';
import CommentMeta from '@/db/models/CommentMeta';
import User from '@/db/models/User';
import Post from '@/db/models/Post';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const comments = await Comment.findAll({
            include: [
                { model: CommentMeta, as: 'meta' },
                { model: User, as: 'commentAuthor' },
                { model: Post, as: 'post' }
            ]
        });
        return NextResponse.json(comments, { status: 200 });
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newComment = await Comment.create(body);
        return NextResponse.json(newComment, { status: 201 });
    } catch (error) {
        console.error('Error creating comment:', error);
        return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }
}
