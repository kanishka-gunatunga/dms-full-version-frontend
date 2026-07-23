"use client";

import Heading from "@/components/common/Heading";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Paragraph from "@/components/common/Paragraph";
import useAuth from "@/hooks/useAuth";
import React, { useEffect, useState } from "react";
import {
  Form,
  Modal,
  Table,
} from "react-bootstrap";
import { FaPlus } from "react-icons/fa6";
import ToastMessage from "@/components/common/Toast";
import { IoClose, IoFolder, IoSaveOutline } from "react-icons/io5";
import { MdCancel } from "react-icons/md";
import { BsDownload } from "react-icons/bs";
import { getWithAuth, postWithAuth, API_BASE_URL } from "@/utils/apiClient";
import DashboardLayout from "@/components/DashboardLayout";
import dayjs from "dayjs";
import Cookies from "js-cookie";

interface SystemBackup {
  id: number;
  filename: string;
  status: string;
  file_size: number | null;
  destination: string;
  is_auto: boolean;
  created_at: string;
}

export default function SystemBackupPage() {
  const isAuthenticated = useAuth();
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [destination, setDestination] = useState("local");
  const [ftpConfig, setFtpConfig] = useState({ host: "", port: "21", username: "", password: "", path: "" });
  const [gDriveConfig, setGDriveConfig] = useState({ client_id: "", client_secret: "", refresh_token: "", folder_id: "" });

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const response = await getWithAuth(`system-backups`);
      if (response && response.backups) {
        setBackups(response.backups);
      }
    } catch (error) {
      console.error("Error fetching backups:", error);
    }
  };

  const handleGenerateBackup = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("destination", destination);

      const response = await postWithAuth(`system-backups/generate`, formData);
      if (response.message) {
        setToastType("success");
        setToastMessage("Backup generation started successfully!");
        setShowToast(true);
        setIsModalOpen(false);
        fetchBackups();
      } else {
        setToastType("error");
        setToastMessage("Failed to start backup!");
        setShowToast(true);
      }
    } catch (error) {
      console.error("Error generating backup:", error);
      setToastType("error");
      setToastMessage("Error triggering backup");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreId) return;
    setIsRestoring(true);
    try {
      const response = await postWithAuth(`system-backups/restore/${restoreId}`, {});
      if (response.message) {
        setToastType("success");
        setToastMessage("System restored successfully! Reloading in 2 seconds...");
        setShowToast(true);
        setIsRestoreModalOpen(false);
        fetchBackups();
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setToastType("error");
        setToastMessage(response.error || "Failed to restore backup!");
        setShowToast(true);
      }
    } catch (error) {
      console.error("Error restoring backup:", error);
      setToastType("error");
      setToastMessage("Error restoring backup");
      setShowToast(true);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const token = Cookies.get("authToken");
      const response = await fetch(`${API_BASE_URL}system-backups/download/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        setToastType("error");
        setToastMessage("Failed to download backup");
        setShowToast(true);
        return;
      }
      
      const resData = await response.json();
      if (resData.status === 'success' && resData.data) {
        const link = document.createElement('a');
        link.href = resData.data;
        link.download = `backup_${id}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setToastType("error");
        setToastMessage("Invalid response from server");
        setShowToast(true);
      }
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  if (!isAuthenticated) return <LoadingSpinner />;

  return (
    <>
      <DashboardLayout>
        <div className="d-flex justify-content-between align-items-center pt-2">
          <Heading text="System Backups" color="#444" />
          <button
            onClick={() => setIsModalOpen(true)}
            className="addButton bg-white text-dark border border-success rounded px-3 py-1"
          >
            <FaPlus className="me-1" /> Generate Backup
          </button>
        </div>

        <div className="d-flex flex-column bg-white p-2 p-lg-3 rounded mt-3">
          <div style={{ maxHeight: "600px", overflowY: "auto" }} className="custom-scroll">
            <Table hover responsive>
              <thead className="sticky-header">
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Destination</th>
                  <th>File Size</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {backups.length > 0 ? (
                  backups.map((item) => (
                    <tr key={item.id}>
                      <td>{dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss")}</td>
                      <td>
                        <span className={`badge ${item.status === 'completed' ? 'bg-success' : item.status === 'failed' ? 'bg-danger' : 'bg-warning'}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {item.destination.toUpperCase()}
                        {item.is_auto && <span className="badge bg-info ms-2">AUTO BACKUP</span>}
                      </td>
                      <td>{item.file_size ? (item.file_size / 1024 / 1024).toFixed(2) + ' MB' : '-'}</td>
                      <td>
                        {item.status === 'completed' && (
                          <div className="d-flex align-items-center">
                            {item.destination === 'local' && !item.is_auto && (
                              <button onClick={() => handleDownload(item.id)} className="btn btn-sm btn-outline-primary me-2">
                                <BsDownload /> Download
                              </button>
                            )}
                            <button onClick={() => { setRestoreId(item.id); setIsRestoreModalOpen(true); }} className="btn btn-sm btn-outline-warning text-dark border-warning">
                              Restore
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-3">
                      <Paragraph text="No backups found" color="#333" />
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>

        <ToastMessage
          message={toastMessage}
          show={showToast}
          onClose={() => setShowToast(false)}
          type={toastType}
        />
      </DashboardLayout>

      <Modal centered show={isModalOpen} onHide={() => setIsModalOpen(false)}>
        <Modal.Header>
          <div className="d-flex w-100 justify-content-end">
            <div className="col-11 d-flex flex-row">
              <IoFolder fontSize={20} className="me-2" />
              <p className="mb-0" style={{ fontSize: "16px", color: "#333" }}>Generate System Backup</p>
            </div>
            <div className="col-1 d-flex justify-content-end">
              <IoClose fontSize={20} style={{ cursor: "pointer" }} onClick={() => setIsModalOpen(false)} />
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="py-3">
          <div className="d-flex flex-column mb-3">
            <p className="mb-1 text-start w-100" style={{ fontSize: "14px" }}>Destination</p>
            <Form.Select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="local">Local (Downloadable)</option>
              <option value="ftp">External FTP</option>
              <option value="google_drive">Google Drive</option>
            </Form.Select>
          </div>
          
          {destination !== 'local' && (
             <div className="bg-light p-3 rounded mt-3">
               <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                 <strong>Note:</strong> Configuration for {destination === 'ftp' ? 'FTP' : 'Google Drive'} will be securely fetched from the backend environment variables.
               </p>
             </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex flex-row">
            <button onClick={handleGenerateBackup} disabled={isSubmitting} className="custom-icon-button button-success px-3 py-1 rounded me-2">
              <IoSaveOutline fontSize={16} className="me-1" /> {isSubmitting ? "Generating..." : "Generate"}
            </button>
            <button onClick={() => setIsModalOpen(false)} className="custom-icon-button button-danger text-white bg-danger px-3 py-1 rounded">
              <MdCancel fontSize={16} className="me-1" /> Cancel
            </button>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal centered show={isRestoreModalOpen} onHide={() => !isRestoring && setIsRestoreModalOpen(false)}>
        <Modal.Header>
          <div className="d-flex w-100 justify-content-end">
            <div className="col-11 d-flex flex-row">
              <p className="mb-0 text-danger fw-bold" style={{ fontSize: "16px" }}>⚠️ Restore Backup</p>
            </div>
            <div className="col-1 d-flex justify-content-end">
              <IoClose fontSize={20} style={{ cursor: isRestoring ? "not-allowed" : "pointer" }} onClick={() => !isRestoring && setIsRestoreModalOpen(false)} />
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="py-3">
          <div className="alert alert-danger mb-0">
            <strong>Warning:</strong> Restoring a backup will completely overwrite your current database and files with the data from this backup. Any changes made or data created after this backup will be permanently lost!
            <br /><br />
            Are you absolutely sure you want to proceed?
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex flex-row">
            <button onClick={handleRestore} disabled={isRestoring} className="custom-icon-button button-danger text-white bg-danger px-3 py-1 rounded me-2">
              {isRestoring ? "Restoring..." : "Yes, Restore System"}
            </button>
            <button onClick={() => setIsRestoreModalOpen(false)} disabled={isRestoring} className="custom-icon-button bg-secondary text-white px-3 py-1 rounded">
              Cancel
            </button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
}
