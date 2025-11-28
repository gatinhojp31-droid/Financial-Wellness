import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PieChart, 
  Shield, 
  Zap, 
  Target, 
  Coffee, 
  ShoppingBag, 
  Car, 
  Home,
  CreditCard,
  Activity,
  User,
  Bell,
  Database
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, writeBatch, setDoc } from 'firebase/firestore';
import { cpf, cnpj } from 'cpf-cnpj-validator'; 

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAMYMfs-x_BPp7mG2uayAbKGzQk5LUbB0Y",
  authDomain: "financial-wellness-hub-a1da4.firebaseapp.com",
  projectId: "financial-wellness-hub-a1da4",
  storageBucket: "financial-wellness-hub-a1da4.firebasestorage.app",
  messagingSenderId: "1076440428624",
  appId: "1:1076440428624:web:49dd123d374e6862166155",
  measurementId: "G-8RNSJT3MD3"
};

// --- INICIALIZAÇÃO ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Definindo o ID do App para organização no banco de dados
const APP_ID = "fluxo-hackathon"; 

// --- DADOS INICIAIS (SEED) ---
const INITIAL_TRANSACTIONS = [
  { id: '1', raw: 'PGTO *UBER DO BRASIL TEC', amount: -24.90, date: new Date().toISOString(), type: 'out' },
  { id: '2', raw: 'TRANSF PIX RECEBIDA - JOAO SILVA', amount: 150.00, date: new Date(Date.now() - 86400000).toISOString(), type: 'in' },
  { id: '3', raw: 'COMPRA CARTAO - PADARIA ESTRELA', amount: -12.50, date: new Date(Date.now() - 172800000).toISOString(), type: 'out' },
  { id: '4', raw: 'PAGAMENTO BOLETO - ALUGUEL IMOB', amount: -1200.00, date: '2023-10-25T10:00:00Z', type: 'out' },
  { id: '5', raw: 'COMPRA MKTPLACE - AMAZON SERV', amount: -189.90, date: '2023-10-24T14:30:00Z', type: 'out' },
];

const INITIAL_CHART_DATA = [
  { name: 'Dia 1', balance: 2400 },
  { name: 'Dia 5', balance: 2100 },
  { name: 'Dia 10', balance: 2800 },
  { name: 'Dia 15', balance: 2600 },
  { name: 'Dia 20', balance: 3200 },
  { name: 'Dia 25', balance: 3000 },
  { name: 'Hoje', balance: 3450 },
];

// --- LÓGICA DE NEGÓCIO --

// Processador de Extrato Inteligente
const smartCategorize = (transaction) => {
  const raw = transaction.raw ? transaction.raw.toUpperCase() : '';
  const dateObj = new Date(transaction.date);
  const formattedDate = dateObj.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  
  if (raw.includes('UBER') || raw.includes('TAXI') || raw.includes('POSTO')) {
    return { name: 'Uber Viagens', category: 'Transporte', icon: <Car size={18} className="text-blue-500" />, color: 'bg-blue-100', date: formattedDate };
  }
  if (raw.includes('PADARIA') || raw.includes('IFOOD') || raw.includes('MERCADO')) {
    return { name: 'Padaria Estrela', category: 'Alimentação', icon: <Coffee size={18} className="text-orange-500" />, color: 'bg-orange-100', date: formattedDate };
  }
  if (raw.includes('AMAZON') || raw.includes('MAGALU')) {
    return { name: 'Amazon Shopping', category: 'Compras', icon: <ShoppingBag size={18} className="text-purple-500" />, color: 'bg-purple-100', date: formattedDate };
  }
  if (raw.includes('ALUGUEL') || raw.includes('LUZ') || raw.includes('NET')) {
    return { name: 'Aluguel Mensal', category: 'Casa', icon: <Home size={18} className="text-red-500" />, color: 'bg-red-100', date: formattedDate };
  }
  if (transaction.type === 'in') {
    return { name: 'Transferência Recebida', category: 'Entrada', icon: <ArrowDownLeft size={18} className="text-green-500" />, color: 'bg-green-100', date: formattedDate };
  }
  
  return { name: 'Outros Gastos', category: 'Geral', icon: <CreditCard size={18} className="text-gray-500" />, color: 'bg-gray-100', date: formattedDate };
};

const ServiceCard = ({ title, icon, color, description, onClick, active }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center p-4 rounded-xl border transition-all duration-300 w-full
    ${active ? `border-${color}-500 bg-${color}-50 ring-2 ring-${color}-200` : 'border-gray-100 bg-white hover:shadow-md'}`}
  >
    <div className={`p-3 rounded-full mb-3 ${active ? 'bg-white' : 'bg-gray-50'}`}>
      {icon}
    </div>
    <span className="font-semibold text-gray-800 text-sm">{title}</span>
    <span className="text-xs text-gray-500 mt-1 text-center">{description}</span>
  </button>
);

const AuthComponent = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [document, setDocument] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setError('');
    if (isRegistering) {
      if (!cpf.isValid(document) && !cnpj.isValid(document)) {
        setError('CPF/CNPJ inválido.');
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          document: document
        });
        onLogin(user);
      } catch (e) {
        setError(e.message);
      }
    } else {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onLogin(userCredential.user);
      } catch (e) {
        setError(e.message);
      }
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{isRegistering ? 'Cadastro' : 'Login'}</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full p-2 mb-4 border rounded"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Senha"
        className="w-full p-2 mb-4 border rounded"
      />
      {isRegistering && (
        <input
          type="text"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          placeholder="CPF ou CNPJ"
          className="w-full p-2 mb-4 border rounded"
        />
      )}
      <button onClick={handleAuth} className="w-full bg-slate-900 text-white p-2 rounded">
        {isRegistering ? 'Cadastrar' : 'Entrar'}
      </button>
      <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-2 text-sm text-center">
        {isRegistering ? 'Já tem uma conta? Entre' : 'Não tem uma conta? Cadastre-se'}
      </button>
    </div>
  );
};


export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); 
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [savings, setSavings] = useState(120.50);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Banco de Dados (Leitura)
  useEffect(() => {
    if (!user) return;

    const txQuery = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions'));
    
    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      txs.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setTransactions(txs);
      
      // Cálculo de Saldo
      const total = txs.reduce((acc, curr) => acc + (curr.amount), 3000); 
      setBalance(total);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao ler transações:", error);
      setLoading(false);
    });

    return () => unsubscribeTx();
  }, [user]);

  // Função para Popular o Banco
  const seedDatabase = async () => {
    if (!user) return;
    setLoading(true);
    const batch = writeBatch(db);
    
    INITIAL_TRANSACTIONS.forEach((tx) => {
      const docRef = doc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions'));
      batch.set(docRef, { ...tx, amount: Number(tx.amount) });
    });

    try {
      await batch.commit();
      console.log("Banco de dados populado!");
    } catch (e) {
      console.error("Erro ao popular DB:", e);
    }
    setLoading(false);
  };

  // Personalização da Saudação
  const getGreeting = () => {
    if (authError) return { text: "Ação Necessária", color: "text-red-600", bg: "bg-red-50" };
    if (loading) return { text: "A carregar...", color: "text-gray-600", bg: "bg-gray-50" };
    if (balance < 1000) return { text: "Atenção ao orçamento hoje, João.", color: "text-orange-600", bg: "bg-orange-50" };
    if (balance > 3000) return { text: "As suas finanças estão ótimas!", color: "text-green-600", bg: "bg-green-50" };
    return { text: "Olá, João. Vamos controlar os gastos?", color: "text-blue-600", bg: "bg-blue-50" };
  };

  const greeting = getGreeting();

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (!user) {
    return <AuthComponent onLogin={setUser} />;
  }


  const renderContent = () => {
    if (activeTab === 'pix') return (
      <div className="animate-fade-in p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="text-yellow-500" /> Pix Inteligente
        </h2>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
            <p className="text-sm text-gray-500 mb-1">Sugestão Automática</p>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-800">Aluguel (Imobiliária)</p>
                <p className="text-xs text-gray-500">Vence em breve</p>
              </div>
              <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">Agendar</button>
            </div>
        </div>
        {/* Botões de ação rápida */}
        <div className="grid grid-cols-3 gap-2">
            {['Pagar', 'Receber', 'Copiar Cola'].map(item => (
              <button key={item} className="p-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                {item}
              </button>
            ))}
          </div>
      </div>
    );

    if (activeTab === 'cashback') return (
      <div className="animate-fade-in p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Target className="text-purple-500" /> Cashback com Propósito</h2>
        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl mb-6">
          <div>
            <p className="text-sm text-purple-600 font-medium">Acumulado para "Viagem"</p>
            <p className="text-2xl font-bold text-purple-900">R$ {savings.toFixed(2)}</p>
          </div>
          <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-purple-600"><Target size={20} /></div>
        </div>
      </div>
    );

    if (activeTab === 'insurance') return (
      <div className="animate-fade-in p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="text-blue-500" /> Seguro On-Demand</h2>
        <div className="p-4 border border-blue-100 bg-blue-50 rounded-xl mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-blue-900">Proteção de Celular</h3>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">ATIVO</span>
          </div>
          <p className="text-sm text-blue-700 mb-4">Custo: R$ 0,99 / dia</p>
        </div>
      </div>
    );

    return (
      <>
        {/* Gráfico */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">Fluxo de Caixa</h3>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">Tempo Real</span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INITIAL_CHART_DATA}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Extrato */}
        <div className="bg-white rounded-t-3xl shadow-lg border-t border-gray-100 -mx-6 px-6 pt-6 pb-20 min-h-[300px]">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-lg text-gray-800">Últimas Atividades</h3>
            <div className="flex gap-2">
               {transactions.length === 0 && !loading && !authError && (
                <button 
                  onClick={seedDatabase} 
                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium flex items-center gap-1 hover:bg-blue-100 transition-colors"
                >
                  <Database size={12} /> Carregar Dados
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {authError ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
                    <p className="font-bold mb-1">Configuração Necessária na Consola Firebase</p>
                    {authError}
                </div>
            ) : loading ? (
              <div className="text-center py-10 text-gray-400">A carregar...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p>Nenhuma transação encontrada.</p>
                <p className="text-xs mt-2">Clique em "Carregar Dados" acima.</p>
              </div>
            ) : (
              transactions.map((t) => {
                const smart = smartCategorize(t);
                return (
                  <div key={t.id} className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${smart.color} transition-transform group-hover:scale-110`}>
                        {smart.icon}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{smart.name}</p>
                        <p className="text-xs text-gray-400 font-medium">{smart.category} • {smart.date}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${t.type === 'in' ? 'text-green-600' : 'text-gray-800'}`}>\
                      {t.type === 'in' ? '+' : '-'} R$ {Math.abs(t.amount).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-24 md:pb-0 md:flex md:justify-center">
      <div className="w-full max-w-md bg-gray-50 md:min-h-screen md:shadow-2xl md:border-x md:border-gray-200 relative">
        
        {/* Header */}
        <header className="p-6 pt-12 pb-4">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold">JS</div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Bem-vindo de volta</p>
                <h1 className="text-xl font-bold text-gray-900">João Silva</h1>
              </div>
            </div>
            <div className="relative">
              <Bell className="text-gray-600" size={24} />
              {balance < 1000 && <div className="absolute top-0 right-0 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-gray-50"></div>}
            </div>
          </div>

          <div className={`p-4 rounded-2xl ${greeting.bg} mb-6 transition-all`}>
            <div className="flex gap-3 items-start">
              <Activity className={greeting.color} size={20} />
              <div>
                <p className={`text-sm font-bold ${greeting.color}`}>{greeting.text}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {authError ? "Verifique as configurações do Firebase." : (balance > 3000 ? "Você está acima da sua meta!" : "Seu ritmo de gastos aumentou.")}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Saldo Disponível</p>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {loading ? "..." : `R$ ${balance.toFixed(2).replace('.', ',')}`}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-2">
            <ServiceCard title="Pix" icon={<Zap size={20} className="text-yellow-600" />} color="yellow" description="Pagar" active={activeTab === 'pix'} onClick={() => setActiveTab(activeTab === 'pix' ? 'home' : 'pix')} />
            <ServiceCard title="Cashback" icon={<Target size={20} className="text-purple-600" />} color="purple" description="Metas" active={activeTab === 'cashback'} onClick={() => setActiveTab(activeTab === 'cashback' ? 'home' : 'cashback')} />
             <ServiceCard title="Seguros" icon={<Shield size={20} className="text-blue-600" />} color="blue" description="Proteger" active={activeTab === 'insurance'} onClick={() => setActiveTab(activeTab === 'insurance' ? 'home' : 'insurance')} />
          </div>
        </header>

        <main className="px-6 pb-24">
          {renderContent()}
        </main>
        <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded">
          Logout
        </button>
        <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-6 flex justify-around items-center md:absolute md:max-w-md md:left-auto">
          <button onClick={() => setActiveTab('home')} className={`p-2 rounded-xl transition-colors ${activeTab === 'home' ? 'text-slate-900 bg-gray-100' : 'text-gray-400 hover:text-gray-600'}`}><Home size={24} /></button>
          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600"><Wallet size={24} /></button>
          <button className="h-14 w-14 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-xl transform -translate-y-6 hover:scale-105 transition-transform"><Zap size={24} /></button>
          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600"><PieChart size={24} /></button>
          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600"><User size={24} /></button>
        </nav>
      </div>
    </div>
  );
}
