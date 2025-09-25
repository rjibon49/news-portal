import { NextResponse } from 'next/server';
import UserMeta from '@/db/models/UserMeta';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const userMetas = await UserMeta.findAll();
        return NextResponse.json(userMetas, { status: 200 });
    } catch (error) {
        console.error('Error fetching user metas:', error);
        return NextResponse.json({ error: 'Failed to fetch user metas' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newUserMeta = await UserMeta.create(body);
        return NextResponse.json(newUserMeta, { status: 201 });
    } catch (error) {
        console.error('Error creating user meta:', error);
        return NextResponse.json({ error: 'Failed to create user meta' }, { status: 500 });
    }
}
