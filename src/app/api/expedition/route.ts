import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SAMPLE_MEMBERS,
  SAMPLE_INCOME,
  SAMPLE_ACCOMMODATION,
  SAMPLE_MEAL_DATES,
  SAMPLE_MEAL_PRICES,
  DEFAULT_TRANSPORT_TYPES,
} from '@/lib/seedData';
import { getSupabaseServer, formatSupabaseError, assertSupabaseOk } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function seedExpeditionData(supabase: SupabaseClient, expeditionId: string) {
  await assertSupabaseOk(
    await supabase.from('members').insert(
      SAMPLE_MEMBERS.map(m => ({
        expedition_id: expeditionId,
        name: m.name,
        role: m.role,
        weight_class: m.weight_class,
        self_payment: m.self_payment,
        subsidy_amount: 0,
        participation_ih: false,
        participation_tohoku: true,
        sort_order: m.sort_order,
      }))
    )
  );

  await assertSupabaseOk(
    await supabase.from('income_items').insert(
      SAMPLE_INCOME.map(i => ({ expedition_id: expeditionId, ...i }))
    )
  );

  await assertSupabaseOk(
    await supabase.from('accommodation_costs').insert({
      expedition_id: expeditionId,
      ...SAMPLE_ACCOMMODATION,
    })
  );

  const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
  const mealInserts = SAMPLE_MEAL_DATES.flatMap(date =>
    mealTypes.map(mealType => ({
      expedition_id: expeditionId,
      date,
      meal_type: mealType,
      target_count: 10,
      non_target_count: 0,
      subsidy_count: 10,
      student_count: 10,
      staff_count: 0,
      subsidy_student_count: 10,
      staff_unit_price: SAMPLE_MEAL_PRICES[mealType],
      unit_price: SAMPLE_MEAL_PRICES[mealType],
    }))
  );
  await assertSupabaseOk(await supabase.from('meal_costs').insert(mealInserts));

  await assertSupabaseOk(
    await supabase.from('transport_costs').insert(
      DEFAULT_TRANSPORT_TYPES.map((t, i) => ({
        expedition_id: expeditionId,
        transport_type: t.type,
        label: t.label,
        amount: t.amount,
        student_amount: t.amount,
        staff_amount: 0,
        per_person: false,
        person_count: 1,
        sort_order: i,
      }))
    )
  );
}

async function createDefaultData(supabase: SupabaseClient, expeditionId: string) {
  await assertSupabaseOk(
    await supabase.from('income_items').insert([
      { expedition_id: expeditionId, category: 'club', label: 'クラブ費収入', amount: 0 },
      { expedition_id: expeditionId, category: 'student_council', label: '生徒会補助', amount: 0 },
      { expedition_id: expeditionId, category: 'subsidy', label: '学校補助金', amount: 0 },
      { expedition_id: expeditionId, category: 'self_burden', label: '自己負担徴収合計', amount: 0 },
    ])
  );

  await assertSupabaseOk(
    await supabase.from('accommodation_costs').insert({
      expedition_id: expeditionId,
      plan_type: '1泊2食',
      unit_price: 0,
      breakfast_price: 0,
      nights: 1,
      subsidy_per_person: 0,
      staff_unit_price: 0,
      staff_breakfast_price: 0,
      staff_subsidy_per_person: 0,
    })
  );

  const transportTypes = [
    'rental_car', 'travel_agency', 'fuel', 'taxi', 'charter', 'highway', 'parking', 'other',
  ];
  const transportLabels: Record<string, string> = {
    rental_car: 'レンタカー', travel_agency: '旅行代', fuel: '燃料代',
    taxi: 'タクシー代', charter: 'チャーター代', highway: '高速道路代', parking: '駐車代', other: 'その他',
  };

  await assertSupabaseOk(
    await supabase.from('transport_costs').insert(
      transportTypes.map((type, i) => ({
        expedition_id: expeditionId,
        transport_type: type,
        label: transportLabels[type],
        amount: 0,
        student_amount: 0,
        staff_amount: 0,
        per_person: false,
        person_count: 1,
        sort_order: i,
      }))
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { name, competition_name, year, start_date, end_date, destination, vehicle_type, useSample } = body;

      if (!name || !competition_name || !start_date || !end_date || !destination) {
        return NextResponse.json({ error: '必須項目が入力されていません' }, { status: 400 });
      }

      const expedition = await assertSupabaseOk(
        await supabase
          .from('expeditions')
          .insert({
            name,
            competition_name,
            year: Number(year) || new Date().getFullYear(),
            start_date,
            end_date,
            destination,
            vehicle_type: vehicle_type || 'microbus',
            school_name: '羽黒高校',
            club_name: 'ウェイトリフティング部',
            status: 'draft',
          })
          .select()
          .single()
      );

      if (useSample) {
        await seedExpeditionData(supabase, expedition.id);
      } else {
        await createDefaultData(supabase, expedition.id);
      }

      return NextResponse.json({ id: expedition.id });
    }

    if (action === 'duplicate') {
      const { expeditionId } = body;

      const source = await assertSupabaseOk(
        await supabase.from('expeditions').select('*').eq('id', expeditionId).single()
      );

      if (!source) {
        return NextResponse.json({ error: '元の遠征が見つかりません' }, { status: 404 });
      }

      const newExp = await assertSupabaseOk(
        await supabase
          .from('expeditions')
          .insert({
            name: `${source.name}（コピー）`,
            competition_name: source.competition_name,
            year: source.year,
            start_date: source.start_date,
            end_date: source.end_date,
            destination: source.destination,
            school_name: source.school_name,
            club_name: source.club_name,
            vehicle_type: source.vehicle_type,
            notes: source.notes,
            status: 'draft',
          })
          .select()
          .single()
      );

      const [memRes, incRes, accRes, mealRes, transRes, otherRes] = await Promise.all([
        supabase.from('members').select('*').eq('expedition_id', expeditionId),
        supabase.from('income_items').select('*').eq('expedition_id', expeditionId),
        supabase.from('accommodation_costs').select('*').eq('expedition_id', expeditionId).maybeSingle(),
        supabase.from('meal_costs').select('*').eq('expedition_id', expeditionId),
        supabase.from('transport_costs').select('*').eq('expedition_id', expeditionId),
        supabase.from('other_costs').select('*').eq('expedition_id', expeditionId),
      ]);

      if (memRes.data?.length) {
        await assertSupabaseOk(
          await supabase.from('members').insert(
            memRes.data.map(({ id, created_at, ...m }) => ({ ...m, expedition_id: newExp.id }))
          )
        );
      }
      if (incRes.data?.length) {
        await assertSupabaseOk(
          await supabase.from('income_items').insert(
            incRes.data.map(({ id, created_at, ...i }) => ({ ...i, expedition_id: newExp.id }))
          )
        );
      }
      if (accRes.data) {
        const { id, ...acc } = accRes.data;
        await assertSupabaseOk(
          await supabase.from('accommodation_costs').insert({ ...acc, expedition_id: newExp.id })
        );
      }
      if (mealRes.data?.length) {
        await assertSupabaseOk(
          await supabase.from('meal_costs').insert(
            mealRes.data.map(({ id, ...m }) => ({ ...m, expedition_id: newExp.id }))
          )
        );
      }
      if (transRes.data?.length) {
        await assertSupabaseOk(
          await supabase.from('transport_costs').insert(
            transRes.data.map(({ id, ...t }) => ({ ...t, expedition_id: newExp.id }))
          )
        );
      }
      if (otherRes.data?.length) {
        await assertSupabaseOk(
          await supabase.from('other_costs').insert(
            otherRes.data.map(({ id, ...o }) => ({ ...o, expedition_id: newExp.id }))
          )
        );
      }

      return NextResponse.json({ id: newExp.id });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (e) {
    console.error('[api/expedition POST]', e);
    return NextResponse.json(
      { error: formatSupabaseError(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const data = await assertSupabaseOk(
      await supabase.from('expeditions').select('*').order('created_at', { ascending: false })
    );
    return NextResponse.json(data);
  } catch (e) {
    console.error('[api/expedition GET]', e);
    return NextResponse.json(
      { error: formatSupabaseError(e) },
      { status: 500 }
    );
  }
}
