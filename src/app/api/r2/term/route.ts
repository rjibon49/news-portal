export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin } from '@/lib/auth/isAdmin';
import { ensureDb } from '@/db/boot';
import Term from '@/db/models/Term';
import TermTaxonomy from '@/db/models/TermTaxonomy';
import { Op } from 'sequelize';

// ensureDb();

export async function GET(req: NextRequest) {
  try {
    // ❶ Register models + associations exactly once for this process
    ensureDb();

    const taxonomy = new URL(req.url).searchParams.get('taxonomy') ?? 'category';

    // ❷ Use the association handle that Sequelize created
    const rows = await Term.findAll({
      attributes: ['term_id', 'name', 'slug', 'term_group'],
      include: [
        {
          // This avoids the “Include unexpected” and “not associated” errors
          association: Term.associations.taxonomies,
          attributes: [
            'term_taxonomy_id',
            'term_id',
            'taxonomy',
            'description',
            'parent',
            'count',
          ],
          where: { taxonomy },
          required: false, // return terms even if they have no taxonomy rows
        },
      ],
      order: [['name', 'ASC']],
    });

    return NextResponse.json(rows, { status: 200 });
  } catch (e: any) {
    console.error('/api/r2/term GET error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id || (session.user.id as string); // Type assertion
  if (!(await isAdmin(Number(userId)))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, slug, taxonomy, description, parent } = body;

    if (!name || !taxonomy) {
      return NextResponse.json({ error: 'Name and taxonomy are required' }, { status: 400 });
    }

    const safeSlug = (slug || name)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 190);

    const existing = await Term.findOne({
      where: { slug: safeSlug },
      include: [
        {
          model: TermTaxonomy,
          as: 'taxonomies',
          where: { taxonomy },
          required: false,
          attributes: ['term_taxonomy_id'],
        },
      ],
    });

    if (existing?.taxonomies?.length) {
      return NextResponse.json({ error: 'Category already exists with this slug' }, { status: 409 });
    }

    const term = existing ?? await Term.create({ name, slug: safeSlug, term_group: 0 });

    const taxonomyRow = await TermTaxonomy.create({
      term_id: term.getDataValue('term_id'),
      taxonomy,
      description: description ?? '',
      parent: parent ?? 0,
      count: 0,
    });

    return NextResponse.json({ term, taxonomy: taxonomyRow }, { status: 201 });
  } catch (e: any) {
    console.error('Error in POST /api/r2/term:', e); // Debug log
    return NextResponse.json({ error: e?.message ?? 'Failed to create' }, { status: 500 });
  }
}