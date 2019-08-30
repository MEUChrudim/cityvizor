import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';

import { DataService } from 'app/services/data.service';
import { CodelistService } from 'app/services/codelist.service';
import { ToastService } from 'app/services/toast.service';

import { BudgetEvent, BudgetPayment, Counterparty } from 'app/schema';

type CounterpartyOpenable = (Counterparty & { open: boolean });

@Component({
	moduleId: module.id,
	selector: 'event-detail',
	templateUrl: 'event-detail.component.html',
	styleUrls: ['event-detail.component.scss'],
	animations: [
		trigger('paymentsState', [
			state('closed', style({ display: 'none', opacity: 0 })),
			state('open', style({ display: 'block', opacity: 1 })),
			transition('closed => open', [style({ height: 0 }), animate('250ms ease-in', style({ opacity: 1, height: '*' }))]),
			transition('open => closed', animate('250ms ease-out', style({ opacity: 0, height: 0 })))
		])
	]
})
export class EventDetailComponent implements OnChanges {

	/* DATA */
	@Input() profileId: string;
	@Input() eventId: number;
	@Input() year: number;

	@Output()
	selectEvent: EventEmitter<string> = new EventEmitter();

	event: BudgetEvent;

	payments: BudgetPayment[] = [];

	counterparties: CounterpartyOpenable[];

	maxExpenditureAmount: number;
	maxIncomeAmount: number;

	history: any[];
	maxHistoryAmount: number = 0;

	constructor(private dataService: DataService, private codelistService: CodelistService, private toastService: ToastService) { }

	ngOnChanges(changes: SimpleChanges) {
		if (this.profileId && this.eventId && this.year) {
			this.loadEvent(this.profileId, this.eventId, this.year);
		}
	}

	async loadEvent(profileId: string, eventId: number, year: number) {
		const event = await this.dataService.getProfileEvent(profileId, eventId, year);

		this.maxExpenditureAmount = Math.max(event.expenditureAmount, event.budgetExpenditureAmount);
		this.maxIncomeAmount = Math.max(event.incomeAmount, event.budgetIncomeAmount);

		this.event = event;

		// get event accross years;
		this.history = await this.dataService.getProfileEventHistory(this.profileId, this.eventId);

		this.maxHistoryAmount = this.history.reduce((acc, cur) => Math.max(acc, cur.expenditureAmount, cur.incomeAmount, cur.budgetExpenditureAmount, cur.budgetIncomeAmount), -Infinity);

		const date = new Date(this.year, 0, 1);

		if (this.event.items) {
			this.event.items = this.event.items.filter(item => item.incomeAmount > 0 || item.budgetIncomeAmount > 0)

			const itemNames = await this.codelistService.getCurrentIndex("items", date);
			this.event.items.forEach(item => item.name = itemNames[item.id]);
		}

		if (this.event.paragraphs) {
			this.event.paragraphs = this.event.paragraphs.filter(paragraph => paragraph.expenditureAmount > 0 || paragraph.budgetExpenditureAmount > 0)

			const paragraphNames = await this.codelistService.getCurrentIndex("paragraphs", date);
			this.event.paragraphs.forEach(paragraph => paragraph.name = paragraphNames[paragraph.id]);
		}

		if (this.event.payments) {

			this.event.payments.sort((a,b) => a.date && b.date ? a.date.localeCompare(b.date) : 0);

			const counterparties: Counterparty[] = [];
			const counterpartyIndex: { [id: string]: Counterparty } = {}
			const noCounterparty = new Counterparty(null, "bez protistrany")

			this.event.payments.forEach(payment => {
				let counterparty = payment.counterpartyId ? counterpartyIndex[payment.counterpartyId] : noCounterparty;
				if (!counterparty) {
					counterparty = new Counterparty(payment.counterpartyId, payment.counterpartyName);
					counterpartyIndex[payment.counterpartyId] = counterparty
					counterparties.push(counterparty);
				}
				counterparty.amount += (payment.incomeAmount - payment.expenditureAmount);
				counterparty.payments.push(payment);
			});

			counterparties.sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount));

			if(noCounterparty.payments.length) counterparties.push(noCounterparty);

			this.counterparties = counterparties.map(counterparty => Object.assign(counterparty, { open: false }));
		}
	}

	openYear(year: number) {
		this.year = year;
		this.loadEvent(this.profileId, this.eventId, this.year);
	}

	openPayments(counterparty) {
		counterparty.open = !counterparty.open;
	}

}