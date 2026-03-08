//
//  NextBookingEntry.swift
//  EquinetWidget
//
//  Timeline entry for the next booking widget.
//

import WidgetKit

struct NextBookingEntry: TimelineEntry {
    let date: Date
    let state: WidgetState
}

enum WidgetState {
    case hasBooking(WidgetBooking)
    case noBooking
    case authNeeded
    case loading
}
