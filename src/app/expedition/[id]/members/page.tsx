'use client';

import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import MemberTable from '@/components/expedition/MemberTable';
import { useExpedition } from '@/hooks/useExpedition';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAutoSave } from '@/hooks/useAutoSave';
import type { Member } from '@/types/expedition';

interface PageProps {
  params: { id: string };
}

export default function MembersPage({ params }: PageProps) {
  const { id } = params;
  const { data, loading, error } = useExpedition(id);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (data) setMembers(data.members);
  }, [data]);

  const saveMembers = useCallback(async () => {
    for (const member of members) {
      const record = { ...member, expedition_id: id };
      if (member.id.startsWith('temp-')) {
        const { id: _, ...insertData } = record;
        await supabase.from('members').insert(insertData);
      } else {
        await supabase.from('members').update(record).eq('id', member.id);
      }
    }
  }, [members, id]);

  useAutoSave(saveMembers, [members]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-danger">{error || '遠征が見つかりません'}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/expedition/${id}`} className="inline-flex items-center text-sm text-gray-500 hover:text-primary mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        収支計算に戻る
      </Link>
      <h2 className="text-xl font-bold text-primary mb-4">名簿管理 - {data.expedition.name}</h2>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-48 flex-shrink-0">
          <Sidebar expeditionId={id} />
        </div>
        <div className="flex-1">
          <MemberTable
            members={members}
            onChange={setMembers}
            expeditionId={id}
          />
        </div>
      </div>
    </div>
  );
}
