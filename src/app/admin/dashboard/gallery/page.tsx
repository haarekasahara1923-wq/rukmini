"use client";
import { useState, useEffect, useRef } from "react";

export default function AdminGallery() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addType, setAddType] = useState<"photo" | "video">("photo");

  const [newItem, setNewItem] = useState({
    category: "General",
    description: "",
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedItemsForDelete, setSelectedItemsForDelete] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    setMsg("");
    try {
      const res = await fetch(`/api/gallery?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg("Item deleted successfully!");
        fetchItems();
      } else {
        setMsg("Error: " + (data.error || "Delete failed"));
      }
    } catch (err) {
      setMsg("Error deleting item");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItemsForDelete.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedItemsForDelete.length} items?`)) return;
    
    setMsg("Deleting items...");
    let successCount = 0;
    for (const id of selectedItemsForDelete) {
      try {
        const res = await fetch(`/api/gallery?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (err) {
        console.error("Error deleting id", id, err);
      }
    }
    
    setMsg(`Deleted ${successCount} out of ${selectedItemsForDelete.length} items successfully!`);
    setSelectedItemsForDelete([]);
    fetchItems();
  };

  const toggleSelectForDelete = (id: number) => {
    setSelectedItemsForDelete(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check size limit: 50MB
    const oversized = files.find(f => f.size > 50 * 1024 * 1024);
    if (oversized) {
      alert("One or more files are too large. Please select files smaller than 50MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFiles(files);
  };

  const handleSaveManual = async () => {
    if (selectedFiles.length === 0) {
      setMsg("Error: Media files are required.");
      return;
    }
    setSaving(true);
    setMsg(`Uploading ${selectedFiles.length} files... This may take a while.`);
    
    let successCount = 0;

    try {
      for (const file of selectedFiles) {
        // 1. Get Signature from Backend
        const sigRes = await fetch("/api/cloudinary-sign");
        const sigData = await sigRes.json();
        
        if (!sigRes.ok || !sigData.signature) {
          throw new Error(sigData.error || "Failed to get upload signature. Backend not configured properly.");
        }

        // 2. Upload to Cloudinary Directly using Signed Upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", sigData.apiKey);
        formData.append("timestamp", sigData.timestamp);
        formData.append("signature", sigData.signature);
        
        // Use /auto/upload to handle both images and videos properly
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`, {
          method: "POST",
          body: formData
        });
        
        const uploadData = await uploadRes.json();
        
        if (!uploadRes.ok) {
          console.error("Cloudinary upload failed for", file.name, uploadData);
          continue; // Skip this file and try next
        }

        // 3. Save to Database
        const res = await fetch("/api/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: file.name.split('.')[0], // Auto-generate title from filename
            type: addType,
            cloudinaryUrl: uploadData.secure_url,
            cloudinaryPublicId: uploadData.public_id,
            thumbnailUrl: uploadData.thumbnail_url || uploadData.secure_url,
            category: newItem.category.trim() || "General",
            description: newItem.description.trim(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        }
      }

      setMsg(`Successfully added ${successCount} out of ${selectedFiles.length} items!`);
      setShowAddModal(false);
      setNewItem({ category: "General", description: "" });
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchItems();
    } catch (err: any) {
      setMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openModalFor = (type: "photo" | "video") => {
    setAddType(type);
    setNewItem({ category: "General", description: "" });
    setSelectedFiles([]);
    setShowAddModal(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--secondary-color)' }}>Gallery Manager</h1>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {selectedItemsForDelete.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              style={{ padding: '10px 20px', background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Delete Selected ({selectedItemsForDelete.length})
            </button>
          )}
          <button 
            onClick={() => openModalFor("photo")}
            style={{ padding: '10px 20px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add Images
          </button>
          <button 
            onClick={() => openModalFor("video")}
            style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add Videos
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "12px", borderRadius: "6px", marginBottom: "20px", background: msg.startsWith("Error") ? "#ffebee" : (msg.includes("Uploading") || msg.includes("Deleting") ? "#fff3e0" : "#e8f5e9"), color: msg.startsWith("Error") ? "#c62828" : (msg.includes("Uploading") || msg.includes("Deleting") ? "#e65100" : "#2e7d32"), fontWeight: (msg.includes("Uploading") || msg.includes("Deleting")) ? "bold" : "normal" }}>
          {msg}
        </div>
      )}

      {loading ? (
        <p>Loading gallery items...</p>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px', background: 'white', borderRadius: '8px', textAlign: 'center', color: '#888' }}>
          No media found. Click "Add Images" or "Add Videos" above!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {items.map(item => (
            <div 
              key={item.id} 
              style={{ 
                background: 'white', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                boxShadow: selectedItemsForDelete.includes(item.id) ? '0 0 0 3px var(--primary-color)' : '0 2px 5px rgba(0,0,0,0.1)',
                position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
                <input 
                  type="checkbox" 
                  checked={selectedItemsForDelete.includes(item.id)}
                  onChange={() => toggleSelectForDelete(item.id)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>
              
              {item.type === "video" ? (
                <video 
                  src={item.cloudinaryUrl} 
                  controls 
                  style={{ width: '100%', height: '150px', objectFit: 'cover', background: '#000' }} 
                />
              ) : (
                <img 
                  src={item.cloudinaryUrl} 
                  alt={item.title} 
                  style={{ width: '100%', height: '150px', objectFit: 'cover' }} 
                />
              )}
              <div style={{ padding: '15px' }}>
                <h4 style={{ margin: '0 0 5px', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                <p style={{ margin: '0 0 15px', color: '#888', fontSize: '0.8rem', textTransform: 'capitalize' }}>{item.type} • {item.category}</p>
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ width: '100%', padding: '8px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Media Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "30px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0, color: "var(--secondary-color)" }}>
              Add Multiple {addType === "photo" ? "Images" : "Videos"}
            </h2>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Select Files from Device *</label>
              <input 
                type="file" 
                accept={addType === "photo" ? "image/*" : "video/*"}
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", boxSizing: "border-box" }}
              />
              {selectedFiles.length > 0 && (
                <p style={{ margin: "5px 0 0", fontSize: "0.8rem", color: "green" }}>
                  {selectedFiles.length} file(s) selected.
                </p>
              )}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Category</label>
              <input 
                value={newItem.category} 
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} 
                placeholder="e.g. Sports, Events, Academics"
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Description (Applied to all)</label>
              <textarea 
                value={newItem.description} 
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} 
                rows={3}
                placeholder="Brief description..."
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ padding: "10px 20px", background: "#f5f5f5", border: "none", borderRadius: "6px", cursor: "pointer", color: "#333", fontWeight: 'bold' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveManual} 
                disabled={saving}
                style={{ padding: "10px 20px", background: "var(--primary-color)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", opacity: saving ? 0.7 : 1, fontWeight: 'bold' }}
              >
                {saving ? "Saving..." : `Upload ${selectedFiles.length} Files`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


