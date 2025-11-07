import React, { useEffect, useState } from "react";

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [plate, setPlate] = useState("");
  const [fiscal, setFiscal] = useState("");
  const [previsaoTime, setPrevisaoTime] = useState("");

  const [reserveModal, setReserveModal] = useState({ open: false, vehicleId: null, name: "" });
  const [reserveCheckoutModal, setReserveCheckoutModal] = useState({ open: false, vehicleId: null, time: "" });
  const [checkinModal, setCheckinModal] = useState({ open: false, vehicleId: null, hadOcc: false, obs: "", fuel: "Cheio" });

  useEffect(() => { fetchVehicles(); }, []);

  async function fetchVehicles() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/vehicles`);
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar ao backend. Verifique o VITE_BACKEND_URL.");
    } finally { setLoading(false); }
  }

  function availablePlates() { return vehicles.filter(v => v.status === "Disponível"); }
  function reservedList() { return vehicles.filter(v => v.status === "Reservado"); }

  function tryAdminLogin(e) {
    e && e.preventDefault();
    if (!adminPassInput) return alert("Informe senha admin");
    if (adminPassInput === "admin10917") {
      setIsAdmin(true); setAdminModalOpen(false); setAdminPassInput("");
    } else alert("Senha incorreta");
  }
  function logoutAdmin() { setIsAdmin(false); }

  // API helpers
  const adminHeaders = () => ({ "Content-Type": "application/json", "x-admin-pass": "admin10917" });

  async function handleCheckout(e) {
    e && e.preventDefault();
    if (!plate || !fiscal || !previsaoTime) return alert("Preencha todos os campos");
    const v = vehicles.find(x => x.placa === plate);
    if (!v) return alert("Veículo não encontrado");
    const res = await fetch(`${BACKEND_BASE}/vehicles/${v.id}/checkout`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal, previsaoRetornoHora: previsaoTime })
    });
    if (!res.ok) return alert("Erro ao registrar saída");
    await fetchVehicles(); setPlate(""); setFiscal(""); setPrevisaoTime("");
  }

  async function confirmReserve() {
    if (!reserveModal.name.trim()) return alert("Informe nome");
    await fetch(`${BACKEND_BASE}/vehicles/${reserveModal.vehicleId}/reserve`, {
      method: "POST", headers: adminHeaders(), body: JSON.stringify({ reservedBy: reserveModal.name.trim() })
    });
    await fetchVehicles(); setReserveModal({ open:false, vehicleId:null, name:"" });
  }

  async function cancelReserveApi(id) {
    if (!confirm("Confirmar cancelamento?")) return;
    await fetch(`${BACKEND_BASE}/vehicles/${id}/reserve`, { method: "DELETE", headers: adminHeaders() });
    await fetchVehicles();
  }

  async function confirmReserveCheckout() {
    if (!reserveCheckoutModal.time) return alert("Informe hora");
    await fetch(`${BACKEND_BASE}/vehicles/${reserveCheckoutModal.vehicleId}/checkout-from-reserve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previsaoRetornoHora: reserveCheckoutModal.time })
    });
    await fetchVehicles(); setReserveCheckoutModal({ open:false, vehicleId:null, time:"" });
  }

  async function confirmCheckin() {
    const id = checkinModal.vehicleId;
    await fetch(`${BACKEND_BASE}/vehicles/${id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hadOccurrence: checkinModal.hadOcc, observation: checkinModal.obs, fuelStatus: checkinModal.fuel })
    });
    await fetchVehicles(); setCheckinModal({ open:false, vehicleId:null, hadOcc:false, obs:"", fuel:"Cheio" });
  }

  async function addVehicleApi(placa, fuelStatus="Cheio") {
    await fetch(`${BACKEND_BASE}/vehicles`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ placa, fuelStatus }) });
    await fetchVehicles();
  }

  async function deleteVehicleApi(id) {
    if (!confirm("Confirmar exclusão?")) return;
    await fetch(`${BACKEND_BASE}/vehicles/${id}`, { method: "DELETE", headers: adminHeaders() });
    await fetchVehicles();
  }

  function fmtTimeOnly(iso){ if (!iso) return "-"; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:20 }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1>Controle de Veículos</h1>
        <div>{isAdmin ? <span style={{marginRight:8}}>Administrador</span> : null}{isAdmin ? <button onClick={logoutAdmin}>Sair</button> : <button onClick={() => setAdminModalOpen(true)}>Entrar como admin</button>}</div>
      </header>

      <section style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginTop:12 }}>
        {["Disponível","Ocupado","Reservado","Manutenção"].map(k => (
          <div key={k} style={{ background:'#fff', padding:12, borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ color:'#6b7280', fontSize:12 }}>{k}</div>
            <div style={{ fontSize:28, fontWeight:700 }}>{vehicles.filter(v=>v.status===k).length}</div>
          </div>
        ))}
      </section>

      <main style={{ display:'flex', gap:16, marginTop:16 }}>
        <div style={{ width:320, background:'#fff', padding:12, borderRadius:8 }}>
          <h3>Registrar saída</h3>
          <form onSubmit={handleCheckout} style={{ display:'grid', gap:8 }}>
            <label>Placa</label>
            <select value={plate} onChange={e=>setPlate(e.target.value)}>
              <option value="">-- selecione --</option>
              {availablePlates().map(v=> <option key={v.id} value={v.placa}>{v.placa}</option>)}
            </select>
            <label>Nome do Fiscal</label>
            <input value={fiscal} onChange={e=>setFiscal(e.target.value)} />
            <label>Previsão de retorno (hora)</label>
            <input type="time" value={previsaoTime} onChange={e=>setPrevisaoTime(e.target.value)} />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button type="submit">Registrar saída</button>
              <button type="button" onClick={()=>{setPlate(''); setFiscal(''); setPrevisaoTime('');}}>Limpar</button>
            </div>
          </form>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ background:'#fff', padding:12, borderRadius:8, marginBottom:12 }}>
            <h3>Veículos (lista)</h3>
            {loading ? <div>Carregando...</div> : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr><th>Placa</th><th>Status</th><th>Combustível</th><th>Fiscal</th><th>Hora saída</th><th>Previsão</th><th>Últ Ocorr.</th><th>Ações</th></tr></thead>
                <tbody>
                  {vehicles.map(v=>(
                    <tr key={v.id} style={{ borderTop:'1px solid #eee' }}>
                      <td>{v.placa}</td><td>{v.status}</td><td>{v.fuelStatus||'-'}</td><td>{v.fiscal||'-'}</td>
                      <td>{fmtTimeOnly(v.horaSaida)}</td><td>{fmtTimeOnly(v.previsaoRetorno)}</td><td>{v.lastObservation? 'Sim': 'Não'}</td>
                      <td style={{ display:'flex', gap:8 }}>
                        {v.status==='Ocupado' && <button onClick={()=>setCheckinModal({...checkinModal, open:true, vehicleId:v.id, fuel:v.fuelStatus||'Cheio'})}>Registrar retorno</button>}
                        {isAdmin && <button onClick={()=>setReserveModal({open:true, vehicleId:v.id, name:''})}>Reservar</button>}
                        {isAdmin && <button onClick={()=>{ const placa = prompt('Nova placa', v.placa); if(placa) addVehicleApi(placa, v.fuelStatus); }}>Editar</button>}
                        {isAdmin && <button onClick={()=>deleteVehicleApi(v.id)}>Excluir</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ background:'#fff', padding:12, borderRadius:8 }}>
            <h3>Reservados</h3>
            <div style={{ display:'grid', gap:8 }}>
              {reservedList().length===0 ? <div>Nenhum veículo reservado.</div> : reservedList().map(v=>(
                <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:8, background:'#f9fafb', borderRadius:6 }}>
                  <div><div style={{ fontWeight:700 }}>{v.placa}</div><div style={{ color:'#6b7280' }}>Reservado por: <strong>{v.reservedBy}</strong></div></div>
                  <div style={{ display:'flex', gap:8 }}>
                    {isAdmin && <button onClick={()=>{ const name = prompt('Novo nome do reservante', v.reservedBy); if(name) { fetch(`${BACKEND_BASE}/vehicles/${v.id}/reserve`, { method:'PUT', headers:adminHeaders(), body:JSON.stringify({reservedBy:name}) }).then(()=>fetchVehicles()); } }}>Editar</button>}
                    {isAdmin && <button onClick={()=>cancelReserveApi(v.id)}>Cancelar</button>}
                    <button onClick={()=>setReserveCheckoutModal({open:true, vehicleId:v.id, time:''})}>Registrar saída</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Simple modals */}
      {adminModalOpen && (
        <div className="modal-backdrop"><div className="modal">
          <h3>Login Administrador</h3>
          <form onSubmit={tryAdminLogin}><input type="password" value={adminPassInput} onChange={e=>setAdminPassInput(e.target.value)} /><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}><button type="button" onClick={()=>setAdminModalOpen(false)}>Cancelar</button><button type="submit">Entrar</button></div></form>
        </div></div>
      )}

      {reserveModal.open && (
        <div className="modal-backdrop"><div className="modal"><h3>Reservar veículo</h3><input value={reserveModal.name} onChange={e=>setReserveModal({...reserveModal, name:e.target.value})} /><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}><button onClick={()=>setReserveModal({open:false,vehicleId:null,name:''})}>Cancelar</button><button onClick={confirmReserve}>Confirmar</button></div></div></div>
      )}

      {reserveCheckoutModal.open && (
        <div className="modal-backdrop"><div className="modal"><h3>Registrar saída (reserva)</h3><input type="time" value={reserveCheckoutModal.time} onChange={e=>setReserveCheckoutModal({...reserveCheckoutModal, time:e.target.value})} /><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}><button onClick={()=>setReserveCheckoutModal({open:false,vehicleId:null,time:''})}>Cancelar</button><button onClick={confirmReserveCheckout}>Confirmar</button></div></div></div>
      )}

      {checkinModal.open && (
        <div className="modal-backdrop"><div className="modal"><h3>Registrar retorno</h3><div><label><input type="radio" checked={!checkinModal.hadOcc} onChange={()=>setCheckinModal({...checkinModal, hadOcc:false})}/> Não</label><label style={{marginLeft:8}}><input type="radio" checked={checkinModal.hadOcc} onChange={()=>setCheckinModal({...checkinModal, hadOcc:true})}/> Sim</label></div>{checkinModal.hadOcc && <textarea value={checkinModal.obs} onChange={e=>setCheckinModal({...checkinModal, obs:e.target.value})} rows={4} />}<div style={{marginTop:8}}><select value={checkinModal.fuel} onChange={e=>setCheckinModal({...checkinModal, fuel:e.target.value})}><option>Cheio</option><option>Meio</option><option>Reserva</option></select></div><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}><button onClick={()=>setCheckinModal({open:false,vehicleId:null,hadOcc:false,obs:'',fuel:'Cheio'})}>Cancelar</button><button onClick={confirmCheckin}>Confirmar</button></div></div></div>
      )}

      {isAdmin && (<div style={{marginTop:12}}><div style={{background:'#fff',padding:12,borderRadius:8}}><h3>Cadastrar veículo</h3><form onSubmit={e=>{e.preventDefault();const placa=e.target.placa.value.trim();const fuel=e.target.fuel.value;if(placa) addVehicleApi(placa,fuel);e.target.reset();}}><input name="placa" placeholder="Placa (ex: ABC1D23)" /><select name="fuel"><option>Cheio</option><option>Meio</option><option>Reserva</option></select><button type="submit">Salvar</button></form></div></div>)}
    </div>
  );
}
