/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class BookingCalendarWidget extends Component {

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");

        this.state = useState({
            currentDate: new Date(),
            bookings: [],
            lanes: [],
            selectedLane: "all",
            searchQuery: "",
            viewMode: "month",
            loading: false,

            // ✅ POPUP STATE
            showPopup: false,
            selectedBooking: null,
        });

        this.laneColors = {
            'Lane 1': '#93C5FD',
            'Lane 2': '#86EFAC',
            'Lane 3': '#FDE68A',
            'Lane 4': '#C4B5FD',
            'Lane 5': '#FCA5A5',
            'Lane 6': '#A7F3D0',
            'Lane 7': '#FBD5B5',
            'Lane 8': '#E0BBE4',
            'Lane 9': '#FFB6C1',
            'Lane 10': '#98D8C8',
        };

        onWillStart(async () => {
            await this.loadData();
        });
    }

    // ================= POPUP FUNCTIONS =================

    onBookingClick = (ev) => {
        const bookingId = parseInt(ev.currentTarget.dataset.bookingId);
        const booking = this.state.bookings.find(b => b.id === bookingId);
        
        if (booking) {
            this.showBookingPopup(booking);
        }
    }

    showBookingPopup = (booking) => {
        this.state.selectedBooking = booking;
        this.state.showPopup = true;
    }

    closePopup = () => {
        this.state.showPopup = false;
        this.state.selectedBooking = null;
    }

    openBookingForm = () => {
        const bookingId = this.state.selectedBooking?.id;
        if (!bookingId) return;

        this.closePopup();

        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "product.slot",
            res_id: bookingId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    // ================= LOAD DATA =================

    async loadData() {
        this.state.loading = true;
        await this.loadLanes();
        await this.loadBookings();
        this.state.loading = false;
    }

    async loadLanes() {
        this.state.lanes = await this.orm.call(
            'product.slot',
            'get_available_lanes',
            []
        );
    }

    async loadBookings() {
        const { startDate, endDate } = this.getRangeByView();

        this.state.bookings = await this.orm.call(
            'product.slot',
            'get_calendar_bookings',
            [startDate, endDate, this.state.selectedLane]
        );

        console.log("===== BOOKINGS LOADED =====");
        console.log("Total bookings:", this.state.bookings.length);
        if (this.state.bookings.length > 0) {
            console.log("First booking:", JSON.stringify(this.state.bookings[0], null, 2));
        }
        console.log("===========================");
    }

    // ================= VIEW DATE RANGE =================

    getRangeByView = () => {
        let start, end;
        const d = new Date(this.state.currentDate);

        if (this.state.viewMode === "day") {
            start = end = d;
        }

        if (this.state.viewMode === "week") {
            const day = d.getDay(); 
            start = new Date(d);
            start.setDate(d.getDate() - day);

            end = new Date(start);
            end.setDate(start.getDate() + 6);
        }

        if (this.state.viewMode === "month") {
            start = new Date(d.getFullYear(), d.getMonth(), 1);
            end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        }

        return {
            startDate: this.formatDate(start),
            endDate: this.formatDate(end)
        };
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    formatFullDate(date) {
        return date.toDateString();
    }

    changeView = (view) => {
        this.state.viewMode = view;
        this.loadBookings();
    }

    prev() {
        if (this.state.viewMode === "day")
            this.state.currentDate.setDate(this.state.currentDate.getDate() - 1);

        if (this.state.viewMode === "week")
            this.state.currentDate.setDate(this.state.currentDate.getDate() - 7);

        if (this.state.viewMode === "month")
            this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);

        this.loadBookings();
    }

    next() {
        if (this.state.viewMode === "day")
            this.state.currentDate.setDate(this.state.currentDate.getDate() + 1);

        if (this.state.viewMode === "week")
            this.state.currentDate.setDate(this.state.currentDate.getDate() + 7);

        if (this.state.viewMode === "month")
            this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);

        this.loadBookings();
    }

    goToToday() {
        this.state.currentDate = new Date();
        this.loadBookings();
    }

    getMonthName() {
        return this.state.currentDate.toLocaleDateString("en", { month: "long", year: "numeric" });
    }

    // ================= FILTERING =================

    onSearchInput(ev) {
        this.state.searchQuery = ev.target.value.toLowerCase();
    }

    matchSearch(booking) {
        if (!this.state.searchQuery) return true;

        const searchLower = this.state.searchQuery;
        
        return (
            // (booking.product_name && booking.product_name.toLowerCase().includes(searchLower)) ||
            (booking.user_name && booking.user_name.toLowerCase().includes(searchLower))
            // (booking.lane_name && booking.lane_name.toLowerCase().includes(searchLower)) ||
            // (booking.sale_id && booking.sale_id.toLowerCase().includes(searchLower))
        );
    }

    selectAllLanes() {
        this.state.selectedLane = "all";
        this.loadBookings();
    }

    selectLane(ev) {
        this.state.selectedLane = ev.currentTarget.dataset.lane;
        this.loadBookings();
    }

    // ================= MONTH VIEW =================

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getDaysInMonth() {
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthLastDate = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            const d = prevMonthLastDate - i;
            const date = new Date(year, month - 1, d);
            const dateStr = this.formatDate(date);

            days.push({
                day: d,
                date: date,
                weekday: weekdayNames[date.getDay()],
                isOtherMonth: true,
                isToday: this.isToday(date),
                bookings: this.state.bookings.filter(b => b.date === dateStr),
            });
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateStr = this.formatDate(date);

            days.push({
                day: d,
                date: date,
                weekday: weekdayNames[date.getDay()],
                isOtherMonth: false,
                isToday: this.isToday(date),
                bookings: this.state.bookings.filter(b => b.date === dateStr),
            });
        }

        const remaining = 42 - days.length;

        for (let i = 1; i <= remaining; i++) {
            const date = new Date(year, month + 1, i);
            const dateStr = this.formatDate(date);

            days.push({
                day: i,
                date: date,
                weekday: weekdayNames[date.getDay()],
                isOtherMonth: true,
                isToday: this.isToday(date),
                bookings: this.state.bookings.filter(b => b.date === dateStr),
            });
        }

        return days;
    }

    // ================= WEEK VIEW =================

    getWeekDays() {
        const days = [];
        const d = new Date(this.state.currentDate);
        const day = d.getDay();
        const start = new Date(d);
        start.setDate(d.getDate() - day);

        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);

            const dateStr = this.formatDate(date);
            const dayBookings = this.state.bookings.filter(b => b.date === dateStr);

            days.push({
                label: date.toLocaleDateString("en", { weekday: "short" }),
                dateStr,
                date,
                bookings: dayBookings
            });
        }

        return days;
    }

    getDayBookings() {
        const dateStr = this.formatDate(this.state.currentDate);
        return this.state.bookings.filter(b => b.date === dateStr);
    }

    getLaneColor(lane) {
        return this.laneColors[lane] || "#D1D5DB";
    }
}

BookingCalendarWidget.template = "lane_booking_calendar.BookingCalendarWidget";
registry.category("actions").add("booking_calendar_widget", BookingCalendarWidget);