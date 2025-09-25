import { NextResponse } from 'next/server';
import TermRelationship from '@/db/models/TermRelationship';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const termRelationships = await TermRelationship.findAll();
        return NextResponse.json(termRelationships, { status: 200 });
    } catch (error) {
        console.error('Error fetching term relationships:', error);
        return NextResponse.json({ error: 'Failed to fetch term relationships' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newTermRelationship = await TermRelationship.create(body);
        return NextResponse.json(newTermRelationship, { status: 201 });
    } catch (error) {
        console.error('Error creating term relationship:', error);
        return NextResponse.json({ error: 'Failed to create term relationship' }, { status: 500 });
    }
}
