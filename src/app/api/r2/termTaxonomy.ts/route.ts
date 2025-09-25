import { NextResponse } from 'next/server';
import TermTaxonomy from '@/db/models/TermTaxonomy';
import Term from '@/db/models/Term';
import Post from '@/db/models/Post';
import { Op } from 'sequelize';

export async function GET(request: Request) {
    try {
        const termTaxonomies = await TermTaxonomy.findAll({
            include: [
                { model: Term },
                { model: Post, as: 'posts' }
            ]
        });
        return NextResponse.json(termTaxonomies, { status: 200 });
    } catch (error) {
        console.error('Error fetching term taxonomies:', error);
        return NextResponse.json({ error: 'Failed to fetch term taxonomies' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newTermTaxonomy = await TermTaxonomy.create(body);
        return NextResponse.json(newTermTaxonomy, { status: 201 });
    } catch (error) {
        console.error('Error creating term taxonomy:', error);
        return NextResponse.json({ error: 'Failed to create term taxonomy' }, { status: 500 });
    }
}
