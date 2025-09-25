import { NextResponse } from 'next/server';
import Link from '@/db/models/Link';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const links = await Link.findAll();
        return NextResponse.json(links, { status: 200 });
    } catch (error) {
        console.error('Error fetching links:', error);
        return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newLink = await Link.create(body);
        return NextResponse.json(newLink, { status: 201 });
    } catch (error) {
        console.error('Error creating link:', error);
        return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }
}
