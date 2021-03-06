import React, { Component } from 'react'
import moment from 'moment'
import { connect } from 'react-redux'

import MainBlock from '../../Components/MainBlock'
import Search from '../../Components/Search'
import Steps from '../../Components/Steps'
import Filters from '../../Components/Filters'
import Destination from '../../Components/Destination'
import SelectPanel from '../../Components/SelectPanel'
import Button from '../../../Common/Components/Button'

import {
  addSelected,
  removeSelected,
  selectIsMaxSelected,
  selectSelected,
  selectQuantity,
  setQuantity,
  updateSelected,
  clearSelected,
  selectDeparture,
  setDeparture
} from '../../../Common/Redux/Services/trips'
import withToast from '../../../Common/HOC/withToast'
import { saveToLS, getFromLS, getOwnerToken, removeFromLS } from '../../../Common/Utils/helpers'
import * as API from '../../Utils/api'
import { IBookedData } from '../../Utils/apiTypes'
import { IStore } from '../../../Common/Redux/types'
import { STEP_IDS } from '../../Utils/constants'
import { RouteComponentProps } from 'react-router-dom'
import { ISelectedData, ITrip } from '../../Utils/appTypes'
import { IState, IProps, IFiltersChange, IBookedType } from './types'
import './styles.scss'
import Title from 'src/App/Components/Title'
import { ITicket } from 'src/Common/Utils/globalTypes';

const MAX = 5

class EditSelectContainer extends Component<
  RouteComponentProps<{}> & IProps,
  IState
  > {
  readonly state: IState = {
    trips: [],
    tripsLocal: [],
    filters: {
      start: undefined,
      end: undefined,
      min: 0,
      max: 2000
    },
    page: 0,
    isLoading: true,
    isCalendarOpen: false
  }

  private filters = React.createRef<Filters>()

  componentDidMount() {
    window.scrollTo(0, 0)
 
    const selectedTrips = getFromLS('editSelection')
    if (!selectedTrips || !this.props.selected) {
      removeFromLS('editSelection')
      return this.props.history.push('/')
    }
    this.setState({
      isLoading: false,
      trips: [...selectedTrips]
    })
    removeFromLS('editSelection')
  }

  componentWillUnmount() {
    this.detachScrollEvent()
  }

  handleFetchTrips = (
    page: number,
    limit: number,
    priceStart: number,
    priceEnd: number,
    dateStart: number,
    dateEnd: number,
    adult: number,
    youth: number,
    departure: string
  ) => {
    return API.getTrips(
      page,
      limit,
      priceStart,
      priceEnd,
      dateStart,
      dateEnd,
      adult,
      youth,
      departure
    )
      .then(({ data }) => {
        console.log("fetch",data);
        this.setState((state: IState) => ({
          isLoading: false,
          trips: [...data],
          tripsLocal: [...data]
        }))
        return data.length
      })
      .catch(err => console.log(err.response))
  }

  getTicketsType = (tickets: ITicket[]) => {
    return tickets
      .reduce((types: string[], ticket: ITicket) => {
        if (!types.includes(ticket.type)) {
          return [...types, ticket.type]
        }
        return types
      }, [])
      .sort()
  }
  isInPriceRange = (trip: any, adult: any, youth: any, priceStart: any, priceEnd: any) => {
    const totalPrice = 2 * ((trip.adultPrice * adult) + (trip.childPrice * youth));
    return totalPrice <= priceEnd && totalPrice >= priceStart;
  }
  isInDateRange = (tickets: any, dateStart: any, dateEnd: any) => {
    let filteredTicket
    filteredTicket = tickets.filter((ticket: any) => this.checkDateRange(ticket, dateStart, dateEnd))
    console.log("filteredTicket",filteredTicket)
    return filteredTicket;
  }
  checkDateRange = (ticket: any, dateStart: any, dateEnd: any) => {
    console.log(+moment(dateStart).format('x'));
    let start=new Date(ticket.date.start).getTime()
     let end=new Date(ticket.date.end).getTime()
    console.log(start);
    return +moment(dateStart).format('x')<=start  && +moment(dateEnd).format('x') >= end
  }
  handleFetchInitialTripsWithFilter = () => {
    this.state.trips = this.state.tripsLocal;
    const { trips, tripsLocal,
      filters: { min, max, start, end }
    } = this.state
    console.log('tripsLocal', tripsLocal)
    console.log('trips', trips)
    let pricefilter = trips.filter((trip: any) => this.isInPriceRange(trip, trip.Adult, trip.Youth, min, max))
    let dateFilter:any=[] ;
     pricefilter.filter((trip: any) => {
   let ticket= this.isInDateRange(trip.tickets, start, end)
     pricefilter.forEach(item=>{
       console.log(ticket)
       if(ticket.length!==0)
       if(item._id===ticket[0].trip)
       dateFilter.push(item);
     })
    
    })
    console.log('dateFilter', dateFilter)
    this.setState({ trips: pricefilter })

    this.setState({ trips:dateFilter})
  }

  handleBookTrips = () => {
    const { selected, quantity, departure } = this.props
    const token = getOwnerToken()

    const bookedTrips = selected.map((selectedItem: ISelectedData) => {
      if (selectedItem.arrivalTicket && selectedItem.departureTicket) {
        return {
          arrivalTicket: selectedItem.arrivalTicket,
          departureTicket: selectedItem.departureTicket
        }
      } else {
        return {
          id: selectedItem.tripId,
          departure: selectedItem.departure.name,
          destination: selectedItem.destination.name,
          dateStart: selectedItem.dateStart,
          dateEnd: selectedItem.dateEnd
        }
      }
    })


    const data: IBookedData = {
      departure,
      Adult: quantity.Adult,
      Youth: quantity.Youth,
      trips: bookedTrips
    }

    if (token) {
      data.ownerHash = token
    }

    API.bookTrips(data)
      .then(res => {
        console.log('resbjhs',res.data);
        const bookedTrips = res.data.trips
        const selectedTrips = this.props.selected.map((item: ISelectedData) => {
          const filteredTrip: IBookedType = bookedTrips.find(
            (trip: IBookedType) => item.tripId === trip.trip
          )
          if (filteredTrip) {
            //item.adultPrice = filteredTrip.cost
          }
          return item
        })

        saveToLS('owner', {
          billing: res.data.billing,
          createdAt: res.data.createdAt,
          token: res.data.owner,
          data: {
            departure,
            quantity,
            selected: selectedTrips
          }
        })

        selectedTrips.forEach((trip) => {
          trip["Adult"] = data.Adult
          trip["Youth"] = data.Youth
        })

        this.props.updateSelected(selectedTrips)
      this.props.history.push('/destinations/deselect')
      })
      .catch(err => this.props.showError(err))
  }

  onSelect = (data: ISelectedData) => {
    if (!this.props.isMax) {
      this.props.addSelected(data)
    }
  }

  onDeselect = (tripId: string) => {
    const selectedTrips = this.state.trips
    const tmpSTrips = selectedTrips.filter((x: any) => x.tripId != tripId)
    this.setState({
      isLoading: false,
      trips: [...tmpSTrips]
    })
    this.props.removeSelected(tripId)
  }

  backBtn = () => {
    this.props.history.push('/destinations/select')
  }

  attachScrollEvent = () => {
    window.addEventListener('scroll', this.handleScroll, false)
  }

  detachScrollEvent = () => {
    window.removeEventListener('scroll', this.handleScroll, false)
  }

  handleScroll = (e: MouseEvent) => {
    const {
      filters: { min, max, start, end }
    } = this.state
    const { quantity, departure } = this.props
    const treshold = 500
    const totalHeight = document.documentElement.scrollHeight
    const windowHeight = window.innerHeight
    const scrollTop = window.pageYOffset

    const offset = totalHeight - (scrollTop + windowHeight)
    if (offset < treshold) {
      this.detachScrollEvent()
      this.setState(
        (state: IState) => ({ page: state.page + 1 }),
        () => {
          this.handleFetchTrips(
            this.state.page,
            10,
            min,
            max,
            start !== undefined ? +moment(start).format('x') : 0,
            end !== undefined ? +moment(end).format('x') : 0,
            quantity.Adult,
            quantity.Youth,
            departure
          ).then((dataLength: number) => {
            if (dataLength > 0) {
              this.attachScrollEvent()
            }
          })
        }
      )
    }
  }

  handleFilterChange = (filters: IFiltersChange, callback?: () => void) => {
    const start = filters.start ? new Date(filters.start.getTime() - (filters.start.getTimezoneOffset() * 60000)) :
      new Date()
    const starto = moment(start.getTime()).endOf('month')
    const end = filters.end ? new Date(filters.end.getTime() - (filters.end.getTimezoneOffset() * 60000)) : new Date(starto.toString())


    filters.start = start
    filters.end = end

    this.setState(
      (state: IState) => ({
        filters: {
          ...state.filters,
          ...filters
        }
      })
      ,
      () => callback && callback()
    )

  }
  
  handleClearFilterDates = () => {
    const {
      filters: { start, end }
    } = this.state

    if (start && end) {
      this.setState(
        (state: IState) => ({
          filters: {
            ...state.filters,
            start: undefined,
            end: undefined
          }
        }),
        () => this.handleFetchInitialTripsWithFilter()
      )
    }
  }

  handleClearFilterPrice = () => {
    const {
      filters: { min, max }
    } = this.state

    if (min !== 0 || max !== 2000) {
      this.setState(
        (state: IState) => ({
          filters: {
            ...state.filters,
            min: 0,
            max: 2000
          }
        }),
        () => this.handleFetchInitialTripsWithFilter()
      )
    }
  }

  calendarOpened = () => this.setState({ isCalendarOpen: true })

  calendarClosed = () => this.setState({ isCalendarOpen: false })
  
  editTrips=()=>{
    const { selected, quantity, departure } = this.props
    const token = getOwnerToken()

    const bookedTrips = selected.map((selectedItem: ISelectedData) => {
      if (selectedItem.arrivalTicket && selectedItem.departureTicket) {
        return {
          arrivalTicket: selectedItem.arrivalTicket,
          departureTicket: selectedItem.departureTicket
        }
      } else {
        return {
          id: selectedItem.tripId,
          departure: selectedItem.departure.name,
          destination: selectedItem.destination.name,
          dateStart: selectedItem.dateStart,
          dateEnd: selectedItem.dateEnd
        }
      }
    })


    const data: IBookedData = {
      departure,
      Adult: quantity.Adult,
      Youth: quantity.Youth,
      trips: bookedTrips
    }

    if (token) {
      data.ownerHash = token
    }

    API.bookTrips(data)
      .then(res => {
        console.log('this.editTrips',res.data)
        const bookedTrips = res.data.trips
        const selectedTrips = this.props.selected.map((item: ISelectedData) => {
          const filteredTrip: IBookedType = bookedTrips.find(
            (trip: IBookedType) => item.tripId === trip.trip
          )
          if (filteredTrip) {
            console.log("")
            //item.adultPrice = filteredTrip.cost
          }
          return item
        })

        saveToLS('owner', {
          billing: res.data.billing,
          createdAt: res.data.createdAt,
          token: res.data.owner,
          data: {
            departure,
            quantity,
            selected: selectedTrips
          }
        })

        selectedTrips.forEach((trip) => {
          trip["Adult"] = data.Adult
          trip["Youth"] = data.Youth
        })

        this.props.updateSelected(selectedTrips)
        this.props.history.push('/destinations/editSelection')
      })
      .catch(err => this.props.showError(err))
  }
  render() {
    const { isCalendarOpen } = this.state
    const { isMax, quantity, selected, departure } = this.props
    return (
      <section className={`edit-select-cnt ${isCalendarOpen ? 'calendar' : ''}`}>
        <MainBlock className="edit-select-cnt-block">
          <Search
            departure={departure}
            setDeparture={this.props.setDeparture}
            setQuantity={this.props.setQuantity}
            quantity={quantity}
            onSubmit={() => {
              this.setState({ isLoading: true })
              this.setState({ tripsLocal: [] })
              this.setState({ trips: [] })
              this.filters.current!.handleClearFilters()
              this.handleFetchTrips(this.state.page, 10, 0, 0, 0, 0, quantity.Adult, quantity.Youth, departure).then(
                () => {
                  this.setState({ isLoading: false })
                  if (this.state.trips.length >= 10 && this.state.trips.length > 0) {
                    this.attachScrollEvent()
                  } 
                }
              )
            }

            }
            initialValue={departure}
          />
          <Steps />
        </MainBlock>
        <section className="edit-select-cnt-inner">
          <section className="edit-select-cnt-edit">
            <div className="edit-select-cnt-header">
              <Title
                className="edit-select-cnt-inner-title"
                text={`This is your ${this.state.trips.length} destinations`}
                selected={[`${this.state.trips.length} destinations`]}
              />
              <Button
                text="return to all destinations"
                variant="gray"
                icon="arrowLeftUpdated"
                className="edit-select-cnt-back-btn"
                onClick={this.backBtn}
              />
            </div>
            <div className="edit-select-cnt-inner-destination-list">
              {this.state.isLoading ? <div>Loading..</div> : null}
              {!this.state.isLoading && this.state.trips.length === 0 ? (
                <div>No ticket found</div>
              ) : null}
              {!this.state.isLoading &&(this.state.trips!=undefined)&&
                this.state.trips.length > 0 &&
                this.state.trips.map((trip: ITrip, index) => {
                  trip.type = 'trip'
                  console.log('this.props.selected', this.state.trips)
                  const filtered = this.state.trips.filter(
                    (item: any) => {
                      // trip._id = item.tripId
                      if (item.tripId === trip._id) {
                        ; (trip.dateStart = item.dateStart),
                          (trip.dateEnd = item.dateEnd)

                        return true
                      }

                      return false
                    }
                  )
                  const isSelected = filtered.length > 0
                  return (

                    <Destination
                      key={index}
                      index={trip._id}
                      data={trip}
                      quantity={quantity}
                      selected={isSelected}
                      onSelect={this.onSelect}
                      onDeselect={this.onDeselect}
                      isMax={isMax}
                      onCalendarOpen={this.calendarOpened}
                      onCalendarClose={this.calendarClosed}
                    />)
                })}
            </div>
          </section>
        </section>
        <SelectPanel
          step={STEP_IDS.SELECT}
          selected={selected}
          isMax={isMax}
          max={MAX}
          onEdit={this.backBtn}
          onNext={this.handleBookTrips}
          isEdit={true}
        />
      </section>
    )
  }
}

const mapStateToProps = (state: IStore) => ({
  isMax: selectIsMaxSelected(state),
  quantity: selectQuantity(state),
  selected: selectSelected(state),
  departure: selectDeparture(state)
}) 

export default connect(
  mapStateToProps,
  {
    addSelected, removeSelected, updateSelected, clearSelected, setQuantity,
    setDeparture
  }
)(withToast(EditSelectContainer))
