import { NextResponse } from 'next/server';
import Option from '@/db/models/Option';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const options = await Option.findAll();
        return NextResponse.json(options, { status: 200 });
    } catch (error) {
        console.error('Error fetching options:', error);
        return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newOption = await Option.create(body);
        return NextResponse.json(newOption, { status: 201 });
    } catch (error) {
        console.error('Error creating option:', error);
        return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
    }
}
