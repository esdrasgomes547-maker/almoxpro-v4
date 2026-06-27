import { AreaChart, Area, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const activity = [
  { label: "Venda: Produto D (3un)", value: "R$ 120,00", type: 'positive' },
  { label: "Ajuste: Produto E (1un)", value: "- R$ 55,00", type: 'negative' },
  { label: "Venda: Produto A (1un)", value: "R$ 1.200,00", type: 'positive' },
  { label: "Venda: Produto B (2un)", value: "R$ 450,00", type: 'positive' },
];

export function TradingDashboard({ totalValue = 0, chartData = [] }: { totalValue?: number, chartData?: any[] }) {
  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';

  const displayActivity = isDemoMode
    ? [
        { label: "Nenhuma venda registrada", value: "R$ 0,00", type: 'positive' },
        { label: "Nenhum ajuste registrado", value: "R$ 0,00", type: 'neutral' },
        { label: "Nenhum envio registrado", value: "R$ 0,00", type: 'positive' },
      ]
    : activity;

  return (
    <div className="bg-[#0D1117] p-4 sm:p-6 rounded-xl border border-border/80 shadow-md">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-white/70 text-xs sm:text-sm font-bold tracking-widest uppercase">
          Total Valor de Venda do Estoque
        </h2>
        <div className="flex items-center gap-3 sm:gap-4 mt-1.5">
          <span className="text-white text-2xl sm:text-4xl font-bold font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
          </span>
          <span className={cn(
            "text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded font-medium",
            isDemoMode ? "bg-stone-500/25 text-stone-400" : "bg-green-500/20 text-green-400"
          )}>
            {isDemoMode ? "0,0% (→)" : "+3.2% (↑)"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Trading Chart Card */}
        <Card className="lg:col-span-2 bg-[#161B22] border-green-500/20 shadow-none">
          <CardContent className="p-4 sm:p-6 h-[200px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#30363d" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363d', borderRadius: '8px' }}
                    itemStyle={{ color: '#00ffaa' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#00ffaa" 
                    strokeWidth={3} 
                    fill="url(#colorValue)" 
                    fillOpacity={0.1}
                    isAnimationActive={typeof window !== 'undefined' && localStorage.getItem('almox_perf_mode') !== 'pocket' && !document.body.classList.contains('ultra-perf-mode')}
                />
                <defs>
                   <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ffaa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00ffaa" stopOpacity={0}/>
                    </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-[10px] text-white/40">
              <span>{`Baseado em ${chartData.length} categorias`}</span>
              <span>Distribuição por Categoria</span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Ticker */}
        <Card className="bg-[#161B22] border-none shadow-none">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-white/70 text-[10px] font-bold uppercase mb-4">Fluxo de Caixa (Real-Time)</h3>
            <div className="space-y-4">
              {displayActivity.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-white/70 truncate flex-1">{item.label}</span>
                  <span className={cn(
                    "font-mono font-bold ml-2", 
                    item.type === 'positive' ? 'text-green-400' : (item.type === 'negative' ? 'text-red-400' : 'text-stone-400')
                  )}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 sm:mt-8 pt-4 border-t border-white/10">
                <span className="text-white/50 text-[11px]">Top 3 SKUs por Valor:</span>
                {isDemoMode ? (
                  <p className="text-stone-400 text-[11px] mt-1 italic">Nenhum dado financeiro</p>
                ) : (
                  <p className="text-white text-[11px] mt-1 font-mono">1. Válvula Clesse - R$ 12k</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
