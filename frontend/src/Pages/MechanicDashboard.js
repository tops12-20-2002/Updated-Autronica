import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Style.css";
import pdfMake from "pdfmake/build/pdfmake.min";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { getJobOrders, createJobOrder, updateJobOrder, deleteJobOrder } from "../api/jobOrders";
import { getDashboardStats } from "../api/dashboard";
import { clearAuth } from "../utils/auth";
import { logout as logoutAPI } from "../api/auth";
pdfMake.vfs = pdfFonts.vfs;

function MechanicDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [jobOrders, setJobOrders] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // JOB ORDER STATES
  const [showJobOrderModal, setShowJobOrderModal] = useState(false);
  const [editJobId, setEditJobId] = useState(null);

  // form fields
  const [jobOrderNo, setJobOrderNo] = useState(1);
  const [clientName, setClientName] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [dateIn, setDateIn] = useState("");
  const [dateRelease, setDateRelease] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("Pending");
  const [address, setAddress] = useState("");
  const [services, setServices] = useState([{ description: "", qty: "1", unit: "", price: "" }]);
  const [parts, setParts] = useState([{ description: "", qty: "1", price: "" }]);

  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  // Load data from API
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobOrdersRes, dashboardRes] = await Promise.all([
        getJobOrders(),
        getDashboardStats(),
      ]);

      if (jobOrdersRes.success) {
        setJobOrders(jobOrdersRes.data);
        if (jobOrdersRes.data.length > 0) {
          const maxNo = Math.max(...jobOrdersRes.data.map(j => j.job_order_no || j.joNumber || 0));
          setJobOrderNo(maxNo + 1);
        }
      }
      if (dashboardRes.success) {
        setDashboardStats(dashboardRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // compute totals
  const calculateTotals = () => {
    const serviceTotal = services.reduce((sum, s) => {
      const q = parseFloat(s.qty) || 0;
      const p = parseFloat(s.price) || 0;
      return sum + q * p;
    }, 0);

    const partsTotal = parts.reduce((sum, p) => {
      const q = parseFloat(p.qty) || 0;
      const pr = parseFloat(p.price) || 0;
      return sum + q * pr;
    }, 0);

    const total = serviceTotal + partsTotal;

    let discountRate = 0;
    if (customerType === "LGU") discountRate = 0.6;
    const discountAmount = total * discountRate;
    const grand = total - discountAmount;

    setSubtotal(total);
    setDiscount(discountAmount);
    setGrandTotal(grand);
  };

  useEffect(() => {
    calculateTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, parts, customerType]);

  // add / update / delete service rows
  const addServiceRow = () => {
    setServices((prev) => [...prev, { description: "", qty: "1", unit: "", price: "" }]);
  };
  const updateService = (index, field, value) => {
    setServices((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };
  const deleteService = (index) => {
    setServices((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  // parts row handlers
  const addPartRow = () => {
    setParts((prev) => [...prev, { description: "", qty: "1", price: "" }]);
  };
  const updatePart = (index, field, value) => {
    setParts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };
  const deletePart = (index) => {
    setParts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const isJobFormValid = () => {
    if (!clientName.trim() || !customerType || !dateIn || !assignedTo.trim()) return false;

    for (const s of services) {
      if (!s.description?.trim() || !s.unit?.trim() || !s.qty || s.price === "" || isNaN(parseFloat(s.price))) return false;
    }

    for (const p of parts) {
      if (!p.description?.trim() || !p.qty || p.price === "" || isNaN(parseFloat(p.price))) return false;
    }

    return true;
  };

  // save job order - API call
  const saveJobOrder = async () => {
    if (!isJobFormValid()) return;

    const orderData = {
      client: clientName,
      address,
      vehicleModel,
      contactNumber,
      plate: plateNumber,
      customerType,
      assignedTo,
      dateIn,
      dateRelease: dateRelease || null,
      status,
      services,
      parts,
      subtotal,
      discount,
      total: grandTotal,
    };

    if (editJobId !== null) {
      const existingJob = jobOrders.find(j => j.id === editJobId);
      orderData.id = editJobId;
      orderData.joNumber = existingJob?.joNumber || existingJob?.job_order_no;
    }

    try {
      let result;
      if (editJobId !== null) {
        result = await updateJobOrder(orderData);
      } else {
        result = await createJobOrder(orderData);
      }

      if (result.success) {
        await loadData();
        resetJobForm();
        setShowJobOrderModal(false);
        setEditJobId(null);
      } else {
        alert(result.error || 'Failed to save job order');
      }
    } catch (error) {
      console.error('Error saving job order:', error);
      alert('Failed to save job order. Please try again.');
    }
  };

  const handleDeleteJobOrder = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job order?')) return;

    try {
      const result = await deleteJobOrder(jobId);
      if (result.success) {
        await loadData();
      } else {
        alert(result.error || 'Failed to delete job order');
      }
    } catch (error) {
      console.error('Error deleting job order:', error);
      alert('Failed to delete job order. Please try again.');
    }
  };

  const resetJobForm = () => {
    setClientName("");
    setVehicleModel("");
    setPlateNumber("");
    setCustomerType("");
    setContactNumber("");
    setDateIn("");
    setDateRelease("");
    setAssignedTo("");
    setStatus("Pending");
    setAddress("");
    setServices([{ description: "", unit: "", qty: "1", price: "" }]);
    setParts([{ description: "", qty: "1", price: "" }]);
    setSubtotal(0);
    setDiscount(0);
    setGrandTotal(0);
  };

  // handle edit
  const handleEditJob = (jobId) => {
    const job = jobOrders.find(j => j.id === jobId);
    if (!job) return;

    setEditJobId(jobId);
    setClientName(job.client || job.customer_name || "");
    setVehicleModel(job.vehicleModel || job.model || "");
    setPlateNumber(job.plate || job.plate_no || "");
    setCustomerType(job.customerType || job.type || "Private");
    setAddress(job.address || "");
    setContactNumber(job.contactNumber || job.contact_no || "");
    setDateIn(job.dateIn || job.date || "");
    setDateRelease(job.dateRelease || job.date_release || "");
    setAssignedTo(job.assignedTo || job.assigned_to || "");
    setStatus(job.status || "Pending");
    setServices(job.services && job.services.length > 0 ? job.services : [{ description: "", unit: "", qty: "1", price: "" }]);
    setParts(job.parts && job.parts.length > 0 ? job.parts : [{ description: "", qty: "1", price: "" }]);
    setSubtotal(parseFloat(job.subtotal || 0));
    setDiscount(parseFloat(job.discount || 0));
    setGrandTotal(parseFloat(job.total || job.total_amount || 0));
    setShowJobOrderModal(true);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await logoutAPI(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const exportJobOrderPDF = async () => {
    const logoBase64 = await loadBase64Image(process.env.PUBLIC_URL + "/AutronicasLogo.png");

    const jobData = {
      joNumber: editJobId !== null ? jobOrders.find(j => j.id === editJobId)?.joNumber || jobOrderNo : jobOrderNo,
      client: clientName,
      address,
      vehicleModel,
      plateNumber,
      dateIn,
      dateRelease,
      customerType,
      assignedTo,
      contactNumber,
      subtotal,
      discount,
      grandTotal,
      services,
      parts
    };

    const serviceRows = jobData.services.map(s => ([
      { text: s.description, fontSize: 10 },
      { text: s.qty, alignment: "center", fontSize: 10 },
      { text: s.unit, alignment: "center", fontSize: 10 },
      { text: Number(s.price).toFixed(2), alignment: "right", fontSize: 10 },
      { text: (parseFloat(s.qty) * parseFloat(s.price)).toFixed(2), alignment: "right", fontSize: 10 }
    ]));

    const partsRows = jobData.parts.map(p => ([
      { text: p.description, fontSize: 10 },
      { text: p.qty, alignment: "center", fontSize: 10 },
      { text: Number(p.price).toFixed(2), alignment: "right", fontSize: 10 },
      { text: (parseFloat(p.qty) * parseFloat(p.price)).toFixed(2), alignment: "right", fontSize: 10 }
    ]));

    const docDefinition = {
      pageSize: "LETTER",
      pageMargins: [40, 25, 40, 40],
      content: [
        { image: logoBase64, width: 180, alignment: "center", margin: [0, 0, 0, 10] },
        { text: "AUTO SERVICE AND SPARE PARTS CORP.", style: "header", alignment: "center" },
        { text: "MAHARLIKA HIGHWAY SITIO BAGONG TULAY BRGY. BUKAL PAGBILAO QUEZON", style: "subheader", alignment: "center", margin: [0, -2, 0, 5] },
        { text: "SMART: 09989990252   GLOBE: 09171874571", alignment: "center", fontSize: 9, margin: [0, 0, 0, 12] },
        { columns: [{ text: "REF NO.: " + jobData.joNumber, bold: true, fontSize: 11 }, { text: "JOB ORDER NO.: " + jobData.joNumber, bold: true, fontSize: 11, alignment: "right" }], margin: [0, 5, 0, 10] },
        { table: { widths: ["*", "*"], body: [[{ text: `Client Name: ${jobData.client}`, fontSize: 10 }, { text: `Address: ${jobData.address}`, fontSize: 10 }], [{ text: `Model: ${jobData.vehicleModel}`, fontSize: 10 }, { text: `Plate No: ${jobData.plateNumber}`, fontSize: 10 }], [{ text: `Date In: ${jobData.dateIn}`, fontSize: 10 }, { text: `Date Out: ${jobData.dateRelease}`, fontSize: 10 }], [{ text: `Customer Type: ${jobData.customerType}`, fontSize: 10 }, { text: `Contact No: ${jobData.contactNumber}`, fontSize: 10 }]] }, layout: "noBorders", margin: [0, 0, 0, 15] },
        { text: "SERVICES", style: "sectitle" },
        { table: { widths: ["*", 40, 40, 60, 60], headerRows: 1, body: [[{ text: "JOB/ITEM DESCRIPTION", bold: true, fontSize: 10 }, { text: "QNT", bold: true, alignment: "center", fontSize: 10 }, { text: "UNIT", bold: true, alignment: "center", fontSize: 10 }, { text: "AMOUNT", bold: true, alignment: "right", fontSize: 10 }, { text: "TOTAL AMOUNT", bold: true, alignment: "right", fontSize: 10 }], ...serviceRows] }, margin: [0, 0, 0, 10] },
        { text: "PARTS", style: "sectitle" },
        { table: { widths: ["*", 40, 60, 60], headerRows: 1, body: [[{ text: "DESCRIPTION", bold: true, fontSize: 10 }, { text: "QNT", bold: true, alignment: "center", fontSize: 10 }, { text: "AMOUNT", bold: true, alignment: "right", fontSize: 10 }, { text: "TOTAL AMOUNT", bold: true, alignment: "right", fontSize: 10 }], ...partsRows] }, margin: [0, 0, 0, 15] },
        { text: `Mechanical/Technician: ${jobData.assignedTo}`, fontSize: 10, margin: [0, 0, 0, 15] },
        { text: `Subtotal: ₱${jobData.subtotal.toFixed(2)}`, alignment: "right", fontSize: 10 },
        { text: `Discount: ₱${jobData.discount.toFixed(2)}`, alignment: "right", fontSize: 10 },
        { text: `Total: ₱${jobData.grandTotal.toFixed(2)}`, bold: true, alignment: "right", fontSize: 11, margin: [0, 0, 0, 20] },
        { columns: [{ width: "50%", stack: [{ text: "General Manager:", fontSize: 9, italics: true }, { text: "Herminia Baracael", fontSize: 10, bold: true, italics: true }], alignment: "center" }, { width: "50%", stack: [{ text: "Prepared By:", fontSize: 9, italics: true }, { text: "Jewell Mabunga", fontSize: 10, bold: true, italics: true }], alignment: "center" }], margin: [0, 20, 0, 30] },
        { absolutePosition: { x: 40, y: 640 }, columns: [{ width: "*", stack: [{ text: "Note: I hereby acknowledge that all items and labor are in good condition/s", fontSize: 9 }, { text: "\n\nReceived By:", fontSize: 10 }, { text: "\n\n_____________________________", fontSize: 10 }] }] }
      ],
      styles: { header: { fontSize: 16, bold: true }, subheader: { fontSize: 10 }, sectitle: { fontSize: 11, bold: true, margin: [0, 5, 0, 5] } }
    };

    pdfMake.createPdf(docDefinition).download(`JOB-ORDER-${jobData.joNumber}.pdf`);
  };

  const loadBase64Image = (url) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
    });
  };

  const totalSales = parseFloat(dashboardStats?.total_sales || 0) || jobOrders.reduce((sum, o) => sum + (parseFloat(o.total || o.total_amount || 0)), 0);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="content">
          <div className="left">
            <img src={process.env.PUBLIC_URL + "/HeaderLogo.png"} className="admin-logo" alt="Autronicas logo" />
          </div>
          <nav className="admin-nav">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className={activeTab === "jobs" ? "active" : ""} onClick={() => setActiveTab("jobs")}>Job Orders</button>
            <button className="logout" onClick={handleLogout}>Logout</button>
          </nav>
        </div>
      </header>

      <div className="dashboard-content">
        {activeTab === "dashboard" && (
          <>
            <h2>Dashboard Overview</h2>
            <div className="cards-grid">
              <div className="card blue">
                <p className="card-title">Total Products</p>
                <h1 className="card-value">{dashboardStats?.total_products || 0}</h1>
              </div>
              <div className="card purple">
                <p className="card-title">Total Jobs</p>
                <h1 className="card-value">{dashboardStats?.total_jobs || jobOrders.length}</h1>
              </div>
              <div className="card green">
                <p className="card-title">Total Sales</p>
                <h1 className="card-value">₱{totalSales.toFixed(2)}</h1>
              </div>
            </div>
          </>
        )}

        {activeTab === "jobs" && (
          <div className="joborders-section">
            <div className="joborders-header">
              <h2>Job Order Management</h2>
              <button className="create-joborder-btn" onClick={() => { resetJobForm(); setEditJobId(null); setShowJobOrderModal(true); }}>Create New Job Order</button>
            </div>
            <div className="joborders-table-wrapper">
              <table className="joborders-table">
                <thead>
                  <tr>
                    <th>JOB ORDER NO.</th>
                    <th>CLIENT NAME</th>
                    <th>VEHICLE MODEL</th>
                    <th>PLATE NUMBER</th>
                    <th>TOTAL PRICE</th>
                    <th>STATUS</th>
                    <th>ASSIGNED TO</th>
                    <th>DATE IN</th>
                    <th>DATE RELEASE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {jobOrders.length === 0 ? (
                    <tr><td colSpan="10" className="empty-message">No job orders created yet.</td></tr>
                  ) : (
                    jobOrders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.joNumber || o.job_order_no}</td>
                        <td>{o.client || o.customer_name}</td>
                        <td>{o.vehicleModel || o.model}</td>
                        <td>{o.plate || o.plate_no}</td>
                        <td>₱{Number(o.total || o.total_amount || 0).toFixed(2)}</td>
                        <td>
                          <span className={o.status === "Pending" ? "status-tag yellow" : o.status === "In Progress" ? "status-tag blue" : "status-tag green"}>{o.status}</span>
                        </td>
                        <td>{o.assignedTo || o.assigned_to}</td>
                        <td>{o.dateIn || o.date}</td>
                        <td>{o.dateRelease || o.date_release || '-'}</td>
                        <td className="actions">
                          <button className="view-edit-btn" onClick={() => handleEditJob(o.id)}>Edit</button>
                          <button className="delete-btn" onClick={() => handleDeleteJobOrder(o.id)} style={{ marginLeft: 8 }}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showJobOrderModal && (
          <div className="joborder-overlay">
            <div className="joborder-modal">
              <div className="modal-header">
                <p className="joborder-inline"><strong>Job Order No. {editJobId !== null ? jobOrders.find(j => j.id === editJobId)?.joNumber || jobOrderNo : jobOrderNo}</strong></p>
                <button className="export-btn" onClick={exportJobOrderPDF} disabled={!isJobFormValid()}>Export as PDF</button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="left">
                    <label>Client Name</label>
                    <input type="text" placeholder="Enter client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                    <label>Address</label>
                    <input type="text" placeholder="Enter address" value={address} onChange={(e) => setAddress(e.target.value)} />
                    <label>Vehicle Model</label>
                    <input type="text" placeholder="Enter vehicle model" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                    <label>Date In</label>
                    <input type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
                    <label>Assigned To</label>
                    <input type="text" placeholder="Enter staff name" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
                  </div>
                  <div className="right">
                    <label>Customer Type</label>
                    <select value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
                      <option value="">Select</option>
                      <option value="LGU">LGU</option>
                      <option value="Private">Private</option>
                      <option value="STAN">STAN</option>
                    </select>
                    <label>Contact Number</label>
                    <input type="text" placeholder="Enter contact number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
                    <label>Plate Number</label>
                    <input type="text" placeholder="Enter plate number" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
                    <label>Date Release</label>
                    <input type="date" value={dateRelease} onChange={(e) => setDateRelease(e.target.value)} />
                    <label>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </div>
                </div>

                <h3 className="section-title">Services</h3>
                <div className="table-headers services-head">
                  <span>Description</span><span>Unit</span><span>Qty</span><span>Price (PHP)</span><span></span>
                </div>
                {services.map((s, i) => (
                  <div className="item-row services-row" key={`s-${i}`}>
                    <input type="text" placeholder="Description" value={s.description} onChange={(e) => updateService(i, "description", e.target.value)} />
                    <input type="text" placeholder="Unit" value={s.unit} onChange={(e) => updateService(i, "unit", e.target.value)} />
                    <input type="number" min="0" placeholder="Qty" value={s.qty} onChange={(e) => updateService(i, "qty", e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="Price" value={s.price} onChange={(e) => updateService(i, "price", e.target.value)} />
                    <button className="delete-box" onClick={() => deleteService(i)} aria-label="Delete service">✕</button>
                  </div>
                ))}
                <button className="small-btn" onClick={addServiceRow}>+ Add Service</button>

                <h3 className="section-title">Parts</h3>
                <div className="table-headers parts-head">
                  <span>Description</span><span>Qty</span><span>Price (PHP)</span><span></span>
                </div>
                {parts.map((p, i) => (
                  <div className="item-row parts-row" key={`p-${i}`}>
                    <input type="text" placeholder="Description" value={p.description} onChange={(e) => updatePart(i, "description", e.target.value)} />
                    <input type="number" min="0" placeholder="Qty" value={p.qty} onChange={(e) => updatePart(i, "qty", e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="Price" value={p.price} onChange={(e) => updatePart(i, "price", e.target.value)} />
                    <button className="delete-box" onClick={() => deletePart(i)} aria-label="Delete part">✕</button>
                  </div>
                ))}
                <button className="small-btn" onClick={addPartRow}>+ Add Part</button>

                <hr />
                <div className="totals">
                  <p>Subtotal: ₱{Number(subtotal).toFixed(2)}</p>
                  <p>Discount: ₱{Number(discount).toFixed(2)}</p>
                  <p><b>Total: ₱{Number(grandTotal).toFixed(2)}</b></p>
                </div>
              </div>

              <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 12 }}>
                <button className="footer-btn back" onClick={() => { setShowJobOrderModal(false); setEditJobId(null); resetJobForm(); }}>Cancel</button>
                <button className="footer-btn save" onClick={calculateTotals} title="Recompute totals">Compute</button>
                <button className="footer-btn finalize" onClick={saveJobOrder} disabled={!isJobFormValid()}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MechanicDashboard;

