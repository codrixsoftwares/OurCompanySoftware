import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ShieldCheck, User, Clock, CheckCircle2 } from 'lucide-react';

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<any[]>('/reports/audit-logs')
      .then((data) => setLogs(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[#120E24]">Security, Audit & Governance Trail</h2>
          <p className="text-xs text-[#585172]">Immutable record of high-value actions and multi-tenant operations</p>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Append-Only Retention Active</span>
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E7E0FB] bg-[#F7F5FE]/60">
          <span className="font-bold text-xs uppercase tracking-wider text-[#120E24]">Audit Stream ({logs.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F5FE] text-[#585172] font-semibold border-b border-[#E7E0FB]">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0FB]/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F6F3FF]/60 transition">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-[#7C2CF5] bg-[#F0ECFC] border border-[#E7E0FB] px-2 py-0.5 rounded-lg text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#120E24]">
                    {log.actorEmail || 'System Service'}
                  </td>
                  <td className="py-3 px-4 text-[#585172]">
                    <span className="font-semibold text-[#120E24]">{log.resourceType}</span> {log.resourceId ? `(${log.resourceId.substring(0, 8)}...)` : ''}
                  </td>
                  <td className="py-3 px-4 text-[#585172] font-mono text-[10px] max-w-xs truncate">
                    {log.details || '—'}
                  </td>
                  <td className="py-3 px-4 text-[#585172]/70 text-right">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
