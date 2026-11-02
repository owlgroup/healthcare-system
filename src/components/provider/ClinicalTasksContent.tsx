import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  User, Calendar, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  fetchClinicalTasks,
  updateClinicalTask,
  type ClinicalTask,
} from '@/lib/ai-assistant-api';

type ClinicalTasksContentProps = {
  portal?: 'doctor' | 'admin';
};

export default function ClinicalTasksContent({ portal = 'doctor' }: ClinicalTasksContentProps) {
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Cancellation dialog states
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTaskId, setCancelTaskId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchClinicalTasks(portal);
      setTasks(data);
    } catch (e) {
      toast.error('Lỗi khi tải danh sách công việc: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleUpdateStatus = async (taskId: string, newStatus: ClinicalTask['status'], reason?: string) => {
    setUpdatingTaskId(taskId);
    try {
      await updateClinicalTask(taskId, newStatus, reason);
      toast.success(
        newStatus === 'COMPLETED'
          ? 'Đã hoàn thành công việc'
          : newStatus === 'IN_PROGRESS'
          ? 'Bắt đầu thực hiện công việc'
          : 'Đã hủy công việc'
      );
      await loadTasks();
    } catch (e) {
      toast.error('Không thể cập nhật công việc: ' + (e as Error).message);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const openCancelDialog = (taskId: string) => {
    setCancelTaskId(taskId);
    setCancelReason('');
    setShowCancelDialog(true);
  };

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do hủy bỏ.');
      return;
    }
    if (cancelTaskId) {
      void handleUpdateStatus(cancelTaskId, 'CANCELLED', cancelReason);
    }
    setShowCancelDialog(false);
  };

  const getStatusBadge = (status: ClinicalTask['status']) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Chờ xử lý</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Đang làm</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Hoàn thành</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Đã hủy</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Công việc lâm sàng</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {portal === 'doctor'
              ? 'Theo dõi các công việc can thiệp y tế và tái khám rủi ro cao của Bác sĩ.'
              : 'Quản lý phân công và chăm sóc theo dõi của Điều dưỡng.'}
          </p>
        </div>
        <Button onClick={() => void loadTasks()} variant="outline" size="sm" className="h-9 px-3 gap-1">
          Làm mới
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] border border-slate-100 bg-card rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground font-semibold">Đang tải danh sách công việc...</span>
        </div>
      ) : tasks.length === 0 ? (
        <Card className="border-slate-100 shadow-sm rounded-2xl text-center py-12 px-6">
          <CardContent className="space-y-3">
            <CheckCircle className="h-10 w-10 text-emerald-500/40 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Không có công việc chưa xử lý</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Tất cả các công việc lâm sàng và theo dõi bệnh nhân có nguy cơ cao đã được hoàn tất hoặc không cần can thiệp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={`border-slate-100 shadow-sm rounded-2xl transition-all ${
                task.status === 'COMPLETED' ? 'bg-slate-50/50 opacity-80' : 'hover:border-slate-200'
              }`}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(task.status)}
                    {task.description?.includes('rủi ro CAO') && (
                      <Badge className="bg-rose-100 text-rose-700 border-rose-200">Nguy cơ cao</Badge>
                    )}
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Hạn: {task.due_date}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 leading-snug">{task.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>

                  {task.patient && (
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-semibold">
                      <User className="h-3 w-3" />
                      <span>
                        BN: {task.patient.legal_last_name} {task.patient.legal_first_name} · SĐT: {task.patient.phone_number}
                      </span>
                    </div>
                  )}

                  {task.status === 'CANCELLED' && task.override_reason && (
                    <div className="bg-rose-50 border border-rose-100/80 rounded-lg p-2.5 text-[11px] text-rose-800 leading-relaxed font-semibold flex gap-1.5 items-start">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>Lý do hủy bỏ: {task.override_reason}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {task.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => void handleUpdateStatus(task.id, 'IN_PROGRESS')}
                      disabled={updatingTaskId !== null}
                      variant="outline"
                      className="h-8.5 rounded-lg text-xs"
                    >
                      Bắt đầu
                    </Button>
                  )}
                  {['PENDING', 'IN_PROGRESS'].includes(task.status) && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => void handleUpdateStatus(task.id, 'COMPLETED')}
                        disabled={updatingTaskId !== null}
                        className="h-8.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      >
                        Xác nhận xong
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openCancelDialog(task.id)}
                        disabled={updatingTaskId !== null}
                        variant="ghost"
                        className="h-8.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs gap-1"
                      >
                        Hủy bỏ
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Override Reason Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 animate-bounce" />
              Lý do hủy bỏ công việc
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Bạn đang yêu cầu hủy bỏ công việc lâm sàng tái khám theo dõi của bệnh nhân. Theo quy định, hành động này yêu cầu cung cấp lý do cụ thể để lưu lại lịch sử thay đổi (Audit Log).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              id="reason"
              placeholder="Nhập lý do hủy bỏ... (ví dụ: Bệnh nhân tự theo dõi tại viện khác)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-xs border-slate-200 focus-visible:ring-rose-500"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowCancelDialog(false)} className="rounded-xl text-xs">
              Hủy bỏ thao tác
            </Button>
            <Button onClick={handleCancelSubmit} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold">
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
